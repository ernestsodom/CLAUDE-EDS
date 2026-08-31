-- =====================================================================
-- 029_court_finishes.sql
-- Acabados de la cancha: color de cesped y color de los postes de luz.
--
-- Son las dos piezas de la especificacion que faltaban para que el
-- trader pueda trasladar a la fabrica como tiene que quedar la cancha,
-- junto al tipo y a la ubicacion de los logos. Y como aquellas, van en
-- catalogos editables y no en ENUMs: la carta de colores cambia con los
-- proveedores y renombrarla no puede exigir una migracion.
--
-- Ademas, `court_models.preview_court_type` alimenta el visualizador 3D
-- de muestra: dice con que geometria (panoramica / semi / normal) se
-- dibuja cada modelo del catalogo.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Catalogos de color
-- ---------------------------------------------------------------------
create table public.turf_colors (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.projects(id) on delete cascade,
  code         text not null,
  name         text not null,
  -- Muestra de color para la UI y para el visualizador 3D. Es ayuda
  -- visual: lo que se le pide a la fabrica es el nombre del catalogo.
  hex          text,
  sort_order   integer not null default 100,
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint turf_colors_uk unique (project_id, code),
  constraint turf_colors_code_ck check (code ~ '^[A-Z0-9_]{2,32}$'),
  constraint turf_colors_hex_ck check (hex is null or hex ~ '^#[0-9A-Fa-f]{6}$')
);

comment on table public.turf_colors is
  'Colores de cesped disponibles por proyecto. Catalogo editable, igual que court_models.';

create index turf_colors_project_idx on public.turf_colors (project_id) where active;

select app.attach_updated_at('public.turf_colors');

create table public.light_post_colors (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.projects(id) on delete cascade,
  code         text not null,
  name         text not null,
  hex          text,
  sort_order   integer not null default 100,
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint light_post_colors_uk unique (project_id, code),
  constraint light_post_colors_code_ck check (code ~ '^[A-Z0-9_]{2,32}$'),
  constraint light_post_colors_hex_ck check (hex is null or hex ~ '^#[0-9A-Fa-f]{6}$')
);

comment on table public.light_post_colors is
  'Colores de los postes de luz. Tabla propia y no compartida con el cesped: son cartas de color distintas y conviene poder cambiarlas por separado.';

create index light_post_colors_project_idx on public.light_post_colors (project_id) where active;

select app.attach_updated_at('public.light_post_colors');

-- ---------------------------------------------------------------------
-- Los colores pasan a formar parte de la especificacion de cada cancha.
--
-- Nullable a proposito: las canchas ya registradas no tienen color
-- elegido y forzarlas ahora obligaria a inventar un valor. En el
-- formulario se ofrecen siempre.
-- ---------------------------------------------------------------------
alter table public.deal_courts
  add column turf_color_id       uuid references public.turf_colors(id) on delete restrict,
  add column light_post_color_id uuid references public.light_post_colors(id) on delete restrict;

comment on column public.deal_courts.turf_color_id is
  'Color de cesped acordado para esta cancha. Nulo = todavia sin definir.';
comment on column public.deal_courts.light_post_color_id is
  'Color de los postes de luz. Nulo = todavia sin definir.';

create index deal_courts_turf_color_idx on public.deal_courts (turf_color_id);
create index deal_courts_post_color_idx on public.deal_courts (light_post_color_id);

-- Geometria con la que el visualizador 3D dibuja cada modelo.
alter table public.court_models
  add column preview_court_type text not null default 'panoramica'
    constraint court_models_preview_type_ck
      check (preview_court_type in ('panoramica', 'semi', 'normal'));

comment on column public.court_models.preview_court_type is
  'Tipo de pista con el que el visualizador 3D representa este modelo. Solo afecta a la imagen de muestra.';

update public.court_models set preview_court_type = 'normal' where code = 'NORMAL';

-- ---------------------------------------------------------------------
-- Aislamiento: los catalogos referenciados tienen que ser del mismo
-- proyecto que la cancha.
--
-- RLS ya impide LEER catalogos de otra unidad de negocio, pero quien
-- tiene acceso a dos proyectos podria enviar un id valido del otro. Esto
-- lo cierra en la base, que es donde se cierra de verdad (§83).
-- ---------------------------------------------------------------------
create or replace function app.deal_court_catalog_guard()
returns trigger
language plpgsql
security definer
set search_path = public, app, pg_temp
as $$
begin
  if not exists (
    select 1 from public.court_models cm
     where cm.id = new.court_model_id and cm.project_id = new.project_id
  ) then
    raise exception 'Violacion de aislamiento entre unidades de negocio: tipo de cancha de otro proyecto'
      using errcode = 'check_violation';
  end if;

  if new.turf_color_id is not null and not exists (
    select 1 from public.turf_colors tc
     where tc.id = new.turf_color_id and tc.project_id = new.project_id
  ) then
    raise exception 'Violacion de aislamiento entre unidades de negocio: color de cesped de otro proyecto'
      using errcode = 'check_violation';
  end if;

  if new.light_post_color_id is not null and not exists (
    select 1 from public.light_post_colors lc
     where lc.id = new.light_post_color_id and lc.project_id = new.project_id
  ) then
    raise exception 'Violacion de aislamiento entre unidades de negocio: color de postes de otro proyecto'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger deal_courts_catalog_guard
  before insert or update on public.deal_courts
  for each row execute function app.deal_court_catalog_guard();

-- ---------------------------------------------------------------------
-- RLS y permisos: identicos a los otros catalogos del modulo.
-- ---------------------------------------------------------------------
grant select, insert, update, delete on public.turf_colors       to authenticated;
grant select, insert, update, delete on public.light_post_colors to authenticated;

alter table public.turf_colors       enable row level security;
alter table public.light_post_colors enable row level security;

do $$
declare r record;
begin
  for r in select unnest(array['turf_colors', 'light_post_colors']) as tbl
  loop
    execute format($p$
      create policy %1$s_select on public.%1$I
        for select to authenticated
        using (project_id in (select app.projects_with_permission('deals.view')));
    $p$, r.tbl);

    execute format($p$
      create policy %1$s_manage on public.%1$I
        for all to authenticated
        using (project_id in (select app.projects_with_permission('settings.manage')))
        with check (project_id in (select app.projects_with_permission('settings.manage')));
    $p$, r.tbl);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- Cartas de color iniciales de ATILA
--
-- Son las cuatro que definio el negocio. Ambas listas se editan desde
-- Configuracion -> Catalogos, asi que anadir un color no requiere tocar
-- nada de esto.
-- ---------------------------------------------------------------------
insert into public.turf_colors (project_id, code, name, hex, sort_order)
select p.id, v.code, v.name, v.hex, v.sort_order
  from public.projects p
  cross join (values
    ('AZUL',        'Azul',        '#1F4FD8', 10),
    ('NEGRO',       'Negro',       '#15161A', 20),
    ('TERRACOTA',   'Terracota',   '#B3502B', 30),
    ('GRIS_OSCURO', 'Gris oscuro', '#3A3F46', 40)
  ) as v(code, name, hex, sort_order)
 where p.code = 'ATILA'
on conflict (project_id, code) do nothing;

insert into public.light_post_colors (project_id, code, name, hex, sort_order)
select p.id, v.code, v.name, v.hex, v.sort_order
  from public.projects p
  cross join (values
    ('AZUL',        'Azul',        '#1F4FD8', 10),
    ('NEGRO',       'Negro',       '#0E0F12', 20),
    ('TERRACOTA',   'Terracota',   '#B3502B', 30),
    ('GRIS_OSCURO', 'Gris oscuro', '#3A3F46', 40)
  ) as v(code, name, hex, sort_order)
 where p.code = 'ATILA'
on conflict (project_id, code) do nothing;

-- ---------------------------------------------------------------------
-- El tablero resume los acabados: es de lo primero que pregunta la
-- fabrica cuando se cierra un negocio.
-- ---------------------------------------------------------------------
-- `create or replace view` no admite insertar columnas en medio de la
-- lista, asi que la vista se rehace. No hay nada que dependa de ella
-- salvo la aplicacion, que la vuelve a leer en el siguiente render.
drop view if exists public.v_deal_board;

create view public.v_deal_board
with (security_invoker = on) as
select
  d.id                    as deal_id,
  d.project_id,
  d.code,
  d.client_name,
  d.country,
  d.city,
  d.status,
  d.courts_count,
  d.total_commission_usd,
  d.opened_at,
  d.expected_close_date,
  d.closed_at,
  d.delivery_date,
  d.contact_name,
  d.contact_email,
  d.contact_phone,
  d.notes,
  coalesce((
    select string_agg(x.label, ', ' order by x.label)
      from (
        select count(*)::text || 'x ' || cm.name as label
          from public.deal_courts dc
          join public.court_models cm on cm.id = dc.court_model_id
         where dc.deal_id = d.id
         group by cm.name
      ) x
  ), '—')                 as court_mix,
  coalesce((
    select string_agg(x.name, ', ' order by x.name)
      from (
        select distinct tc.name
          from public.deal_courts dc
          join public.turf_colors tc on tc.id = dc.turf_color_id
         where dc.deal_id = d.id
      ) x
  ), '—')                 as turf_colors,
  coalesce((
    select string_agg(x.name, ', ' order by x.name)
      from (
        select distinct lc.name
          from public.deal_courts dc
          join public.light_post_colors lc on lc.id = dc.light_post_color_id
         where dc.deal_id = d.id
      ) x
  ), '—')                 as light_post_colors,
  (select count(*) from public.deal_courts dc
    where dc.deal_id = d.id and dc.is_custom) as custom_courts,
  case
    when d.status in ('CERRADA', 'ENTREGADA') and d.delivery_date is not null
      then (d.delivery_date - current_date)
  end                     as days_to_delivery,
  d.created_at,
  d.updated_at
from public.deals d
where d.deleted_at is null;

comment on view public.v_deal_board is
  'Tablero del trader: un negocio por fila, con mezcla de canchas, acabados, comision y fechas.';

grant select on public.v_deal_board to authenticated;
