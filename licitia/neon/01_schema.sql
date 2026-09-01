-- ============================================================================
-- LicitIA en Neon — capa de compatibilidad
--
-- El esquema de la aplicacion se mantiene TAL CUAL (35 tablas, 65 policies
-- RLS). Lo unico que Supabase aportaba y Neon no trae de fabrica es el
-- esquema `auth`: la tabla de identidades y la funcion `auth.uid()` que
-- usan las 22 expresiones de las policies.
--
-- En Supabase, auth.uid() leia el `sub` del JWT que PostgREST publicaba en
-- cada peticion. En Neon no hay PostgREST: la aplicacion abre la conexion,
-- asi que es ella la que declara de quien es la sesion con
--     select set_config('app.user_id', $1, true)   -- true = solo esta transaccion
-- al inicio de cada transaccion. `local = true` es deliberado: con un pool
-- de conexiones, un valor de sesion se filtraria a la siguiente peticion
-- que reutilice esa conexion.
--
-- Asi las 65 policies siguen siendo la frontera de seguridad real, sin
-- reescribir ninguna.
-- ============================================================================

create extension if not exists vector;
create extension if not exists pg_trgm;
create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;
create extension if not exists citext;

create schema if not exists auth;

-- Identidades. La gestiona el proveedor de autenticacion elegido (Neon
-- Auth / Better Auth); aqui vive el minimo que el esquema referencia:
-- profiles.id -> auth.users(id).
create table if not exists auth.users (
  id            uuid primary key default gen_random_uuid(),
  email         citext unique,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('app.user_id', true), '')::uuid;
$$;

-- Equivalentes de los roles de Supabase, para que los GRANT del volcado
-- se apliquen sin cambios.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end;
$$;

grant usage on schema auth to anon, authenticated, service_role;
grant select on auth.users to authenticated, service_role;

-- ---------------------------------------------------------------------
-- Rol de aplicacion
--
-- PostgreSQL EXIME al dueño de una tabla de sus propias politicas RLS. Si
-- la aplicacion se conectara con el rol dueño (el que Neon crea por
-- defecto), los 65 candados quedarian desactivados en silencio y nadie se
-- enteraria hasta que un usuario viera datos de otra organizacion.
--
-- Por eso la aplicacion se conecta con este rol, que no es dueño de nada.
-- La contrasena se fija al crear el proyecto en Neon y viaja en
-- DATABASE_URL; aqui no se escribe ninguna.
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'app_user') then
    create role app_user login;
  end if;
end;
$$;

grant usage on schema public, auth to app_user;
grant select, insert, update, delete on all tables in schema public to app_user;
grant usage, select on all sequences in schema public to app_user;
grant execute on all functions in schema public to app_user;
grant select on auth.users to app_user;

alter default privileges in schema public
  grant select, insert, update, delete on tables to app_user;
alter default privileges in schema public
  grant usage, select on sequences to app_user;
--
-- PostgreSQL database dump
--

\restrict NLgcznxTaJjj9hgVk8RcsOCrOVBkaNbYedlaRrh73MfqvFZunkP7Iqg4pYoVUn4

-- Dumped from database version 16.13 (Ubuntu 16.13-0ubuntu0.24.04.1)
-- Dumped by pg_dump version 16.13 (Ubuntu 16.13-0ubuntu0.24.04.1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA IF NOT EXISTS public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: claim_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.claim_status AS ENUM (
    'nuevo',
    'analizado',
    'respondido',
    'cerrado'
);


--
-- Name: comparison_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.comparison_type AS ENUM (
    'cumplimiento',
    'licitacion_vs_licitacion',
    'propuesta_vs_propuesta',
    'contrato_vs_contrato',
    'version_vs_version'
);


--
-- Name: document_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.document_status AS ENUM (
    'subido',
    'procesando',
    'procesado',
    'error',
    'archivado'
);


--
-- Name: document_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.document_type AS ENUM (
    'licitacion',
    'bases_administrativas',
    'bases_tecnicas',
    'propuesta_comercial',
    'propuesta_tecnica',
    'carta_gantt',
    'contrato',
    'anexo',
    'reclamo',
    'informe',
    'acta',
    'avance',
    'otro',
    'control_entregas'
);


--
-- Name: milestone_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.milestone_type AS ENUM (
    'inicio',
    'hito',
    'capacitacion',
    'implementacion',
    'marcha_blanca',
    'recepcion',
    'garantia',
    'soporte',
    'termino',
    'entregable',
    'otro'
);


--
-- Name: processing_step; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.processing_step AS ENUM (
    'extraccion_texto',
    'ocr',
    'chunking',
    'embeddings',
    'clasificacion',
    'resumen',
    'variables',
    'timeline',
    'completado',
    'requerimientos',
    'sistemas'
);


--
-- Name: requirement_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.requirement_status AS ENUM (
    'cumplido',
    'parcial',
    'pendiente',
    'no_aplica',
    'fuera_de_alcance',
    'adicional'
);


--
-- Name: risk_level; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.risk_level AS ENUM (
    'bajo',
    'medio',
    'alto',
    'critico'
);


--
-- Name: user_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.user_role AS ENUM (
    'admin',
    'supervisor',
    'usuario'
);


--
-- Name: variable_category; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.variable_category AS ENUM (
    'sistema',
    'modulo',
    'funcionalidad',
    'integracion',
    'api',
    'reporte',
    'dashboard',
    'interfaz',
    'servicio_web',
    'base_datos',
    'infraestructura',
    'seguridad',
    'backup',
    'migracion',
    'capacitacion',
    'implementacion',
    'mesa_ayuda',
    'soporte',
    'sla',
    'hardware',
    'software',
    'licencia',
    'multa',
    'garantia',
    'certificacion',
    'personal',
    'experiencia',
    'otro'
);


--
-- Name: can_read_document(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_read_document(doc_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1 from documents d
    where d.id = doc_id
      and d.organization_id = current_org_id()
      and (
        current_role_of() in ('admin', 'supervisor')
        or d.created_by = auth.uid()
        or exists (select 1 from document_permissions p
                   where p.document_id = d.id and p.user_id = auth.uid())
      )
  );
$$;


--
-- Name: current_org_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.current_org_id() RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select organization_id from profiles where id = auth.uid();
$$;


--
-- Name: current_role_of(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.current_role_of() RETURNS public.user_role
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select role from profiles where id = auth.uid();
$$;


--
-- Name: dashboard_stats(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.dashboard_stats() RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select jsonb_build_object(
    'total_documents',  (select count(*) from documents d where can_read_document(d.id)),
    'total_clients',    (select count(*) from clients where organization_id = current_org_id()),
    'total_tenders',    (select count(*) from documents d where can_read_document(d.id) and d.doc_type = 'licitacion'),
    'pending_documents',(select count(*) from documents d where can_read_document(d.id) and d.status in ('subido','procesando')),
    'error_documents',  (select count(*) from documents d where can_read_document(d.id) and d.status = 'error'),
    'total_amount',     (select coalesce(sum(amount), 0) from documents d where can_read_document(d.id)),
    'total_requirements',(select count(*) from requirements r where can_read_document(r.document_id)),
    'by_type',          (select coalesce(jsonb_object_agg(doc_type, n), '{}'::jsonb) from
                          (select doc_type, count(*) n from documents d
                           where can_read_document(d.id) group by doc_type) s),
    'by_status',        (select coalesce(jsonb_object_agg(status, n), '{}'::jsonb) from
                          (select status, count(*) n from documents d
                           where can_read_document(d.id) group by status) s)
  );
$$;


--
-- Name: has_document_permission(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_document_permission(doc_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1 from document_permissions p
    where p.document_id = doc_id and p.user_id = auth.uid()
  );
$$;


--
-- Name: hybrid_search(text, public.vector, integer, uuid[], public.document_type, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.hybrid_search(query_text text, query_embedding public.vector, match_count integer DEFAULT 12, filter_document_ids uuid[] DEFAULT NULL::uuid[], filter_doc_type public.document_type DEFAULT NULL::public.document_type, filter_client_id uuid DEFAULT NULL::uuid) RETURNS TABLE(chunk_id uuid, document_id uuid, content text, page_start integer, page_end integer, section text, score double precision)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  with vec as (
    select chunk_id, row_number() over () as r
    from match_chunks(query_embedding, match_count * 2,
                      filter_document_ids, filter_doc_type, filter_client_id)
  ),
  lex as (
    select chunk_id, row_number() over () as r
    from search_chunks_text(query_text, match_count * 2,
                            filter_document_ids, filter_doc_type, filter_client_id)
  ),
  fused as (
    select coalesce(v.chunk_id, l.chunk_id) as chunk_id,
           coalesce(1.0 / (60 + v.r), 0) + coalesce(1.0 / (60 + l.r), 0) as score
    from vec v full outer join lex l using (chunk_id)
  )
  select c.id, c.document_id, c.content, c.page_start, c.page_end, c.section, f.score
  from fused f
  join document_chunks c on c.id = f.chunk_id
  order by f.score desc
  limit match_count;
$$;


--
-- Name: match_chunks(public.vector, integer, uuid[], public.document_type, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.match_chunks(query_embedding public.vector, match_count integer DEFAULT 12, filter_document_ids uuid[] DEFAULT NULL::uuid[], filter_doc_type public.document_type DEFAULT NULL::public.document_type, filter_client_id uuid DEFAULT NULL::uuid) RETURNS TABLE(chunk_id uuid, document_id uuid, content text, page_start integer, page_end integer, section text, similarity double precision)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select c.id, c.document_id, c.content, c.page_start, c.page_end, c.section,
         1 - (c.embedding <=> query_embedding) as similarity
  from document_chunks c
  join documents d on d.id = c.document_id
  where c.embedding is not null
    and can_read_document(d.id)
    and (filter_document_ids is null or c.document_id = any(filter_document_ids))
    and (filter_doc_type is null or d.doc_type = filter_doc_type)
    and (filter_client_id is null or d.client_id = filter_client_id)
  order by c.embedding <=> query_embedding
  limit match_count;
$$;


--
-- Name: search_chunks_text(text, integer, uuid[], public.document_type, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.search_chunks_text(query_text text, match_count integer DEFAULT 12, filter_document_ids uuid[] DEFAULT NULL::uuid[], filter_doc_type public.document_type DEFAULT NULL::public.document_type, filter_client_id uuid DEFAULT NULL::uuid) RETURNS TABLE(chunk_id uuid, document_id uuid, content text, page_start integer, page_end integer, section text, rank double precision)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select c.id, c.document_id, c.content, c.page_start, c.page_end, c.section,
         ts_rank(c.tsv, websearch_to_tsquery('spanish', query_text)) as rank
  from document_chunks c
  join documents d on d.id = c.document_id
  where c.tsv @@ websearch_to_tsquery('spanish', query_text)
    and can_read_document(d.id)
    and (filter_document_ids is null or c.document_id = any(filter_document_ids))
    and (filter_doc_type is null or d.doc_type = filter_doc_type)
    and (filter_client_id is null or d.client_id = filter_client_id)
  order by rank desc
  limit match_count;
$$;


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at = now();
  return new;
end $$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: ai_usage_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_usage_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    provider text NOT NULL,
    model text NOT NULL,
    feature text NOT NULL,
    input_tokens integer DEFAULT 0 NOT NULL,
    output_tokens integer DEFAULT 0 NOT NULL,
    document_id uuid,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: app_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.app_settings (
    organization_id uuid NOT NULL,
    chat_model text,
    embedding_model text,
    ocr_enabled boolean DEFAULT true NOT NULL,
    max_upload_mb integer DEFAULT 50 NOT NULL,
    extra jsonb DEFAULT '{}'::jsonb NOT NULL
);


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_logs (
    id bigint NOT NULL,
    organization_id uuid,
    user_id uuid,
    action text NOT NULL,
    entity_type text,
    entity_id uuid,
    detail jsonb,
    ip inet,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: audit_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.audit_logs ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.audit_logs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: checklist_comparisons; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.checklist_comparisons (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    document_id uuid NOT NULL,
    file_name text NOT NULL,
    total_features integer DEFAULT 0 NOT NULL,
    matched integer DEFAULT 0 NOT NULL,
    completed integer DEFAULT 0 NOT NULL,
    missing integer DEFAULT 0 NOT NULL,
    extra integer DEFAULT 0 NOT NULL,
    pct_completed real DEFAULT 0 NOT NULL,
    result jsonb NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: claim_responses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.claim_responses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    claim_id uuid NOT NULL,
    content text NOT NULL,
    citations jsonb,
    model text,
    approved boolean DEFAULT false NOT NULL,
    approved_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: claims; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.claims (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    client_id uuid,
    contract_document_id uuid,
    subject text,
    raw_email text NOT NULL,
    status public.claim_status DEFAULT 'nuevo'::public.claim_status NOT NULL,
    analysis jsonb,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: clients; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clients (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name text NOT NULL,
    kind text,
    country text DEFAULT 'Chile'::text,
    region text,
    city text,
    contact_email text,
    contact_phone text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: comparison_folders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.comparison_folders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    project_id uuid NOT NULL,
    name text NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: comparison_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.comparison_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    comparison_id uuid NOT NULL,
    requirement_id uuid,
    requirement_text text NOT NULL,
    status public.requirement_status NOT NULL,
    evidence_quote text,
    evidence_document_id uuid,
    evidence_page integer,
    ai_comment text,
    risk public.risk_level DEFAULT 'medio'::public.risk_level NOT NULL,
    priority public.risk_level DEFAULT 'medio'::public.risk_level NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL
);


--
-- Name: comparisons; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.comparisons (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    comparison_type public.comparison_type NOT NULL,
    source_document_id uuid NOT NULL,
    target_document_id uuid NOT NULL,
    status text DEFAULT 'procesando'::text NOT NULL,
    pct_fulfilled real,
    pct_partial real,
    pct_pending real,
    pct_additional real,
    pct_out_of_scope real,
    traffic_light text,
    summary text,
    differences jsonb,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    summary_points jsonb,
    project_id uuid,
    folder_id uuid
);


--
-- Name: conversation_tags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conversation_tags (
    conversation_id uuid NOT NULL,
    tag text NOT NULL
);


--
-- Name: conversations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conversations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    user_id uuid NOT NULL,
    document_id uuid,
    agent text DEFAULT 'analista'::text NOT NULL,
    title text DEFAULT 'Nueva conversación'::text NOT NULL,
    is_favorite boolean DEFAULT false NOT NULL,
    duplicated_from uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: delivered_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.delivered_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    document_id uuid NOT NULL,
    title text NOT NULL,
    description text,
    delivered_on date,
    delivery_state text DEFAULT 'entregado'::text NOT NULL,
    is_additional boolean DEFAULT false NOT NULL,
    is_free boolean DEFAULT false NOT NULL,
    requirement_ref text,
    page integer,
    quote text,
    confidence real,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: document_chunks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_chunks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    document_id uuid NOT NULL,
    version_id uuid NOT NULL,
    chunk_index integer NOT NULL,
    content text NOT NULL,
    page_start integer,
    page_end integer,
    section text,
    token_count integer,
    embedding public.vector(1536),
    tsv tsvector GENERATED ALWAYS AS (to_tsvector('spanish'::regconfig, content)) STORED,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: document_metadata; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_metadata (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    document_id uuid NOT NULL,
    key text NOT NULL,
    value text,
    value_json jsonb,
    source text DEFAULT 'ia'::text NOT NULL
);


--
-- Name: document_pages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_pages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    version_id uuid NOT NULL,
    page_number integer NOT NULL,
    content text NOT NULL,
    ocr_used boolean DEFAULT false NOT NULL
);


--
-- Name: document_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_permissions (
    document_id uuid NOT NULL,
    user_id uuid NOT NULL,
    can_write boolean DEFAULT false NOT NULL,
    granted_by uuid,
    granted_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: document_summaries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_summaries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    document_id uuid NOT NULL,
    version_id uuid NOT NULL,
    summary text,
    objective text,
    scope text,
    problems jsonb,
    requirements jsonb,
    obligations jsonb,
    restrictions jsonb,
    risks jsonb,
    critical_points jsonb,
    deliverables jsonb,
    schedule jsonb,
    recommendations jsonb,
    model text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    implementation_deadline text,
    budget_amount real,
    budget_currency text,
    budget_period text,
    budget_detail text,
    evaluation_criteria jsonb,
    evaluation_methodology text,
    requested_annexes jsonb
);


--
-- Name: document_tags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_tags (
    document_id uuid NOT NULL,
    tag_id uuid NOT NULL
);


--
-- Name: document_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_versions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    document_id uuid NOT NULL,
    version integer NOT NULL,
    change_note text,
    is_current boolean DEFAULT true NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    analysis_engine text
);


--
-- Name: documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    client_id uuid,
    parent_document_id uuid,
    title text NOT NULL,
    doc_type public.document_type DEFAULT 'otro'::public.document_type NOT NULL,
    status public.document_status DEFAULT 'subido'::public.document_status NOT NULL,
    processing_step public.processing_step,
    processing_error text,
    tender_number text,
    tender_name text,
    market_id text,
    provider text,
    area text,
    project_type text,
    country text,
    region text,
    city text,
    doc_date date,
    amount numeric(18,2),
    currency text DEFAULT 'CLP'::text,
    contract_duration text,
    language text DEFAULT 'es'::text,
    doc_state text,
    page_count integer,
    is_scanned boolean DEFAULT false NOT NULL,
    classification jsonb,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    project_id uuid
);


--
-- Name: files; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.files (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    version_id uuid NOT NULL,
    storage_path text NOT NULL,
    file_name text NOT NULL,
    mime_type text NOT NULL,
    size_bytes bigint NOT NULL,
    checksum_sha256 text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid NOT NULL,
    role text NOT NULL,
    content text NOT NULL,
    citations jsonb,
    confidence real,
    model text,
    token_usage jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT messages_role_check CHECK ((role = ANY (ARRAY['user'::text, 'assistant'::text, 'system'::text])))
);


--
-- Name: milestones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.milestones (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    timeline_id uuid NOT NULL,
    milestone_type public.milestone_type DEFAULT 'hito'::public.milestone_type NOT NULL,
    title text NOT NULL,
    description text,
    starts_on date,
    ends_on date,
    duration_label text,
    page integer,
    quote text,
    sort_order integer DEFAULT 0 NOT NULL,
    is_estimated boolean DEFAULT false NOT NULL
);


--
-- Name: note_attachments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.note_attachments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    note_id uuid NOT NULL,
    storage_path text NOT NULL,
    file_name text NOT NULL,
    mime_type text,
    size_bytes bigint,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: notes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    document_id uuid NOT NULL,
    user_id uuid NOT NULL,
    kind text DEFAULT 'comentario'::text NOT NULL,
    content text NOT NULL,
    page integer,
    due_date date,
    resolved boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: organizations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organizations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    settings jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    organization_id uuid NOT NULL,
    email text NOT NULL,
    full_name text,
    avatar_url text,
    role public.user_role DEFAULT 'usuario'::public.user_role NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: projects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.projects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    client_id uuid,
    name text NOT NULL,
    description text,
    status text DEFAULT 'activo'::text NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: requirements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.requirements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    document_id uuid NOT NULL,
    code text,
    title text NOT NULL,
    description text,
    category text,
    mandatory boolean DEFAULT true,
    page integer,
    quote text,
    priority public.risk_level DEFAULT 'medio'::public.risk_level,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    critical_type text,
    deadline_text text
);


--
-- Name: system_features; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.system_features (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    system_id uuid NOT NULL,
    document_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    deadline_text text,
    deadline_date date,
    page integer,
    quote text,
    is_mandatory boolean DEFAULT true NOT NULL,
    is_completed boolean DEFAULT false NOT NULL,
    completed_at timestamp with time zone,
    completed_by uuid,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: systems; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.systems (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    document_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    deadline_text text,
    deadline_date date,
    page integer,
    quote text,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: tags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tags (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name text NOT NULL,
    color text DEFAULT '#6366f1'::text
);


--
-- Name: technical_variables; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.technical_variables (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    document_id uuid NOT NULL,
    category public.variable_category NOT NULL,
    name text NOT NULL,
    description text,
    value text,
    page integer,
    quote text,
    confidence real,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: timelines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.timelines (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    document_id uuid NOT NULL,
    title text DEFAULT 'Cronograma del proyecto'::text NOT NULL,
    generated_by text DEFAULT 'ia'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ai_usage_log ai_usage_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_usage_log
    ADD CONSTRAINT ai_usage_log_pkey PRIMARY KEY (id);


--
-- Name: app_settings app_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_settings
    ADD CONSTRAINT app_settings_pkey PRIMARY KEY (organization_id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: checklist_comparisons checklist_comparisons_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checklist_comparisons
    ADD CONSTRAINT checklist_comparisons_pkey PRIMARY KEY (id);


--
-- Name: claim_responses claim_responses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.claim_responses
    ADD CONSTRAINT claim_responses_pkey PRIMARY KEY (id);


--
-- Name: claims claims_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.claims
    ADD CONSTRAINT claims_pkey PRIMARY KEY (id);


--
-- Name: clients clients_organization_id_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_organization_id_name_key UNIQUE (organization_id, name);


--
-- Name: clients clients_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_pkey PRIMARY KEY (id);


--
-- Name: comparison_folders comparison_folders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comparison_folders
    ADD CONSTRAINT comparison_folders_pkey PRIMARY KEY (id);


--
-- Name: comparison_folders comparison_folders_project_id_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comparison_folders
    ADD CONSTRAINT comparison_folders_project_id_name_key UNIQUE (project_id, name);


--
-- Name: comparison_items comparison_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comparison_items
    ADD CONSTRAINT comparison_items_pkey PRIMARY KEY (id);


--
-- Name: comparisons comparisons_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comparisons
    ADD CONSTRAINT comparisons_pkey PRIMARY KEY (id);


--
-- Name: conversation_tags conversation_tags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_tags
    ADD CONSTRAINT conversation_tags_pkey PRIMARY KEY (conversation_id, tag);


--
-- Name: conversations conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_pkey PRIMARY KEY (id);


--
-- Name: delivered_items delivered_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivered_items
    ADD CONSTRAINT delivered_items_pkey PRIMARY KEY (id);


--
-- Name: document_chunks document_chunks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_chunks
    ADD CONSTRAINT document_chunks_pkey PRIMARY KEY (id);


--
-- Name: document_chunks document_chunks_version_id_chunk_index_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_chunks
    ADD CONSTRAINT document_chunks_version_id_chunk_index_key UNIQUE (version_id, chunk_index);


--
-- Name: document_metadata document_metadata_document_id_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_metadata
    ADD CONSTRAINT document_metadata_document_id_key_key UNIQUE (document_id, key);


--
-- Name: document_metadata document_metadata_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_metadata
    ADD CONSTRAINT document_metadata_pkey PRIMARY KEY (id);


--
-- Name: document_pages document_pages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_pages
    ADD CONSTRAINT document_pages_pkey PRIMARY KEY (id);


--
-- Name: document_pages document_pages_version_id_page_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_pages
    ADD CONSTRAINT document_pages_version_id_page_number_key UNIQUE (version_id, page_number);


--
-- Name: document_permissions document_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_permissions
    ADD CONSTRAINT document_permissions_pkey PRIMARY KEY (document_id, user_id);


--
-- Name: document_summaries document_summaries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_summaries
    ADD CONSTRAINT document_summaries_pkey PRIMARY KEY (id);


--
-- Name: document_summaries document_summaries_version_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_summaries
    ADD CONSTRAINT document_summaries_version_id_key UNIQUE (version_id);


--
-- Name: document_tags document_tags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_tags
    ADD CONSTRAINT document_tags_pkey PRIMARY KEY (document_id, tag_id);


--
-- Name: document_versions document_versions_document_id_version_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_versions
    ADD CONSTRAINT document_versions_document_id_version_key UNIQUE (document_id, version);


--
-- Name: document_versions document_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_versions
    ADD CONSTRAINT document_versions_pkey PRIMARY KEY (id);


--
-- Name: documents documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_pkey PRIMARY KEY (id);


--
-- Name: files files_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.files
    ADD CONSTRAINT files_pkey PRIMARY KEY (id);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);


--
-- Name: milestones milestones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.milestones
    ADD CONSTRAINT milestones_pkey PRIMARY KEY (id);


--
-- Name: note_attachments note_attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.note_attachments
    ADD CONSTRAINT note_attachments_pkey PRIMARY KEY (id);


--
-- Name: notes notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notes
    ADD CONSTRAINT notes_pkey PRIMARY KEY (id);


--
-- Name: organizations organizations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_pkey PRIMARY KEY (id);


--
-- Name: organizations organizations_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_slug_key UNIQUE (slug);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: projects projects_organization_id_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_organization_id_name_key UNIQUE (organization_id, name);


--
-- Name: projects projects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_pkey PRIMARY KEY (id);


--
-- Name: requirements requirements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.requirements
    ADD CONSTRAINT requirements_pkey PRIMARY KEY (id);


--
-- Name: system_features system_features_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_features
    ADD CONSTRAINT system_features_pkey PRIMARY KEY (id);


--
-- Name: systems systems_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.systems
    ADD CONSTRAINT systems_pkey PRIMARY KEY (id);


--
-- Name: tags tags_organization_id_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tags
    ADD CONSTRAINT tags_organization_id_name_key UNIQUE (organization_id, name);


--
-- Name: tags tags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tags
    ADD CONSTRAINT tags_pkey PRIMARY KEY (id);


--
-- Name: technical_variables technical_variables_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.technical_variables
    ADD CONSTRAINT technical_variables_pkey PRIMARY KEY (id);


--
-- Name: timelines timelines_document_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.timelines
    ADD CONSTRAINT timelines_document_id_key UNIQUE (document_id);


--
-- Name: timelines timelines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.timelines
    ADD CONSTRAINT timelines_pkey PRIMARY KEY (id);


--
-- Name: idx_ai_usage_org_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_usage_org_created ON public.ai_usage_log USING btree (organization_id, created_at DESC);


--
-- Name: idx_ai_usage_org_provider; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_usage_org_provider ON public.ai_usage_log USING btree (organization_id, provider, created_at DESC);


--
-- Name: idx_audit_org_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_org_date ON public.audit_logs USING btree (organization_id, created_at DESC);


--
-- Name: idx_checklist_cmp_doc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_checklist_cmp_doc ON public.checklist_comparisons USING btree (document_id);


--
-- Name: idx_chunks_doc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chunks_doc ON public.document_chunks USING btree (document_id);


--
-- Name: idx_chunks_embedding; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chunks_embedding ON public.document_chunks USING hnsw (embedding public.vector_cosine_ops) WITH (m='16', ef_construction='64');


--
-- Name: idx_chunks_tsv; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chunks_tsv ON public.document_chunks USING gin (tsv);


--
-- Name: idx_claim_responses_claim; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_claim_responses_claim ON public.claim_responses USING btree (claim_id);


--
-- Name: idx_claims_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_claims_org ON public.claims USING btree (organization_id);


--
-- Name: idx_clients_name_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clients_name_trgm ON public.clients USING gin (name public.gin_trgm_ops);


--
-- Name: idx_clients_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clients_org ON public.clients USING btree (organization_id);


--
-- Name: idx_comparison_folders_project; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comparison_folders_project ON public.comparison_folders USING btree (project_id);


--
-- Name: idx_comparison_items_cmp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comparison_items_cmp ON public.comparison_items USING btree (comparison_id);


--
-- Name: idx_comparisons_folder; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comparisons_folder ON public.comparisons USING btree (folder_id);


--
-- Name: idx_comparisons_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comparisons_org ON public.comparisons USING btree (organization_id);


--
-- Name: idx_comparisons_project; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comparisons_project ON public.comparisons USING btree (project_id);


--
-- Name: idx_comparisons_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comparisons_source ON public.comparisons USING btree (source_document_id);


--
-- Name: idx_conversations_doc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conversations_doc ON public.conversations USING btree (document_id);


--
-- Name: idx_conversations_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conversations_user ON public.conversations USING btree (user_id);


--
-- Name: idx_delivered_items_additional; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_delivered_items_additional ON public.delivered_items USING btree (is_additional) WHERE is_additional;


--
-- Name: idx_delivered_items_doc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_delivered_items_doc ON public.delivered_items USING btree (document_id);


--
-- Name: idx_documents_client; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_documents_client ON public.documents USING btree (client_id);


--
-- Name: idx_documents_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_documents_date ON public.documents USING btree (doc_date);


--
-- Name: idx_documents_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_documents_org ON public.documents USING btree (organization_id);


--
-- Name: idx_documents_project; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_documents_project ON public.documents USING btree (project_id);


--
-- Name: idx_documents_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_documents_status ON public.documents USING btree (status);


--
-- Name: idx_documents_tender; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_documents_tender ON public.documents USING btree (tender_number);


--
-- Name: idx_documents_title_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_documents_title_trgm ON public.documents USING gin (title public.gin_trgm_ops);


--
-- Name: idx_documents_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_documents_type ON public.documents USING btree (doc_type);


--
-- Name: idx_features_doc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_features_doc ON public.system_features USING btree (document_id);


--
-- Name: idx_features_system; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_features_system ON public.system_features USING btree (system_id);


--
-- Name: idx_files_version; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_files_version ON public.files USING btree (version_id);


--
-- Name: idx_messages_conversation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_conversation ON public.messages USING btree (conversation_id);


--
-- Name: idx_metadata_doc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_metadata_doc ON public.document_metadata USING btree (document_id);


--
-- Name: idx_metadata_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_metadata_key ON public.document_metadata USING btree (key);


--
-- Name: idx_milestones_timeline; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_milestones_timeline ON public.milestones USING btree (timeline_id);


--
-- Name: idx_note_attachments_note; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_note_attachments_note ON public.note_attachments USING btree (note_id);


--
-- Name: idx_notes_doc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notes_doc ON public.notes USING btree (document_id);


--
-- Name: idx_notes_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notes_user ON public.notes USING btree (user_id);


--
-- Name: idx_pages_version; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pages_version ON public.document_pages USING btree (version_id);


--
-- Name: idx_profiles_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_org ON public.profiles USING btree (organization_id);


--
-- Name: idx_projects_client; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_projects_client ON public.projects USING btree (client_id);


--
-- Name: idx_projects_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_projects_org ON public.projects USING btree (organization_id);


--
-- Name: idx_requirements_critical; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_requirements_critical ON public.requirements USING btree (document_id, critical_type) WHERE (critical_type IS NOT NULL);


--
-- Name: idx_requirements_doc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_requirements_doc ON public.requirements USING btree (document_id);


--
-- Name: idx_systems_doc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_systems_doc ON public.systems USING btree (document_id);


--
-- Name: idx_tech_vars_cat; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tech_vars_cat ON public.technical_variables USING btree (category);


--
-- Name: idx_tech_vars_doc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tech_vars_doc ON public.technical_variables USING btree (document_id);


--
-- Name: idx_tech_vars_name_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tech_vars_name_trgm ON public.technical_variables USING gin (name public.gin_trgm_ops);


--
-- Name: idx_versions_doc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_versions_doc ON public.document_versions USING btree (document_id);


--
-- Name: claims trg_claims_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_claims_updated BEFORE UPDATE ON public.claims FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: clients trg_clients_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_clients_updated BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: comparisons trg_comparisons_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_comparisons_updated BEFORE UPDATE ON public.comparisons FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: conversations trg_conversations_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_conversations_updated BEFORE UPDATE ON public.conversations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: documents trg_documents_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_documents_updated BEFORE UPDATE ON public.documents FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: system_features trg_features_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_features_updated BEFORE UPDATE ON public.system_features FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: notes trg_notes_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_notes_updated BEFORE UPDATE ON public.notes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: organizations trg_organizations_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_organizations_updated BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: profiles trg_profiles_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: projects trg_projects_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_projects_updated BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: ai_usage_log ai_usage_log_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_usage_log
    ADD CONSTRAINT ai_usage_log_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: ai_usage_log ai_usage_log_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_usage_log
    ADD CONSTRAINT ai_usage_log_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE SET NULL;


--
-- Name: ai_usage_log ai_usage_log_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_usage_log
    ADD CONSTRAINT ai_usage_log_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: app_settings app_settings_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_settings
    ADD CONSTRAINT app_settings_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: audit_logs audit_logs_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE SET NULL;


--
-- Name: checklist_comparisons checklist_comparisons_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checklist_comparisons
    ADD CONSTRAINT checklist_comparisons_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: checklist_comparisons checklist_comparisons_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checklist_comparisons
    ADD CONSTRAINT checklist_comparisons_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE CASCADE;


--
-- Name: checklist_comparisons checklist_comparisons_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checklist_comparisons
    ADD CONSTRAINT checklist_comparisons_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: claim_responses claim_responses_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.claim_responses
    ADD CONSTRAINT claim_responses_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: claim_responses claim_responses_claim_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.claim_responses
    ADD CONSTRAINT claim_responses_claim_id_fkey FOREIGN KEY (claim_id) REFERENCES public.claims(id) ON DELETE CASCADE;


--
-- Name: claims claims_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.claims
    ADD CONSTRAINT claims_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;


--
-- Name: claims claims_contract_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.claims
    ADD CONSTRAINT claims_contract_document_id_fkey FOREIGN KEY (contract_document_id) REFERENCES public.documents(id) ON DELETE SET NULL;


--
-- Name: claims claims_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.claims
    ADD CONSTRAINT claims_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: claims claims_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.claims
    ADD CONSTRAINT claims_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: clients clients_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: comparison_folders comparison_folders_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comparison_folders
    ADD CONSTRAINT comparison_folders_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: comparison_folders comparison_folders_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comparison_folders
    ADD CONSTRAINT comparison_folders_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: comparison_folders comparison_folders_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comparison_folders
    ADD CONSTRAINT comparison_folders_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: comparison_items comparison_items_comparison_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comparison_items
    ADD CONSTRAINT comparison_items_comparison_id_fkey FOREIGN KEY (comparison_id) REFERENCES public.comparisons(id) ON DELETE CASCADE;


--
-- Name: comparison_items comparison_items_evidence_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comparison_items
    ADD CONSTRAINT comparison_items_evidence_document_id_fkey FOREIGN KEY (evidence_document_id) REFERENCES public.documents(id) ON DELETE SET NULL;


--
-- Name: comparison_items comparison_items_requirement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comparison_items
    ADD CONSTRAINT comparison_items_requirement_id_fkey FOREIGN KEY (requirement_id) REFERENCES public.requirements(id) ON DELETE SET NULL;


--
-- Name: comparisons comparisons_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comparisons
    ADD CONSTRAINT comparisons_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: comparisons comparisons_folder_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comparisons
    ADD CONSTRAINT comparisons_folder_id_fkey FOREIGN KEY (folder_id) REFERENCES public.comparison_folders(id) ON DELETE SET NULL;


--
-- Name: comparisons comparisons_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comparisons
    ADD CONSTRAINT comparisons_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: comparisons comparisons_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comparisons
    ADD CONSTRAINT comparisons_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE SET NULL;


--
-- Name: comparisons comparisons_source_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comparisons
    ADD CONSTRAINT comparisons_source_document_id_fkey FOREIGN KEY (source_document_id) REFERENCES public.documents(id) ON DELETE CASCADE;


--
-- Name: comparisons comparisons_target_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comparisons
    ADD CONSTRAINT comparisons_target_document_id_fkey FOREIGN KEY (target_document_id) REFERENCES public.documents(id) ON DELETE CASCADE;


--
-- Name: conversation_tags conversation_tags_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_tags
    ADD CONSTRAINT conversation_tags_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- Name: conversations conversations_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE CASCADE;


--
-- Name: conversations conversations_duplicated_from_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_duplicated_from_fkey FOREIGN KEY (duplicated_from) REFERENCES public.conversations(id) ON DELETE SET NULL;


--
-- Name: conversations conversations_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: conversations conversations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: delivered_items delivered_items_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivered_items
    ADD CONSTRAINT delivered_items_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE CASCADE;


--
-- Name: document_chunks document_chunks_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_chunks
    ADD CONSTRAINT document_chunks_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE CASCADE;


--
-- Name: document_chunks document_chunks_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_chunks
    ADD CONSTRAINT document_chunks_version_id_fkey FOREIGN KEY (version_id) REFERENCES public.document_versions(id) ON DELETE CASCADE;


--
-- Name: document_metadata document_metadata_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_metadata
    ADD CONSTRAINT document_metadata_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE CASCADE;


--
-- Name: document_pages document_pages_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_pages
    ADD CONSTRAINT document_pages_version_id_fkey FOREIGN KEY (version_id) REFERENCES public.document_versions(id) ON DELETE CASCADE;


--
-- Name: document_permissions document_permissions_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_permissions
    ADD CONSTRAINT document_permissions_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE CASCADE;


--
-- Name: document_permissions document_permissions_granted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_permissions
    ADD CONSTRAINT document_permissions_granted_by_fkey FOREIGN KEY (granted_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: document_permissions document_permissions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_permissions
    ADD CONSTRAINT document_permissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: document_summaries document_summaries_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_summaries
    ADD CONSTRAINT document_summaries_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE CASCADE;


--
-- Name: document_summaries document_summaries_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_summaries
    ADD CONSTRAINT document_summaries_version_id_fkey FOREIGN KEY (version_id) REFERENCES public.document_versions(id) ON DELETE CASCADE;


--
-- Name: document_tags document_tags_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_tags
    ADD CONSTRAINT document_tags_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE CASCADE;


--
-- Name: document_tags document_tags_tag_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_tags
    ADD CONSTRAINT document_tags_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES public.tags(id) ON DELETE CASCADE;


--
-- Name: document_versions document_versions_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_versions
    ADD CONSTRAINT document_versions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: document_versions document_versions_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_versions
    ADD CONSTRAINT document_versions_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE CASCADE;


--
-- Name: documents documents_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;


--
-- Name: documents documents_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: documents documents_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: documents documents_parent_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_parent_document_id_fkey FOREIGN KEY (parent_document_id) REFERENCES public.documents(id) ON DELETE SET NULL;


--
-- Name: documents documents_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE SET NULL;


--
-- Name: files files_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.files
    ADD CONSTRAINT files_version_id_fkey FOREIGN KEY (version_id) REFERENCES public.document_versions(id) ON DELETE CASCADE;


--
-- Name: messages messages_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- Name: milestones milestones_timeline_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.milestones
    ADD CONSTRAINT milestones_timeline_id_fkey FOREIGN KEY (timeline_id) REFERENCES public.timelines(id) ON DELETE CASCADE;


--
-- Name: note_attachments note_attachments_note_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.note_attachments
    ADD CONSTRAINT note_attachments_note_id_fkey FOREIGN KEY (note_id) REFERENCES public.notes(id) ON DELETE CASCADE;


--
-- Name: notes notes_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notes
    ADD CONSTRAINT notes_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE CASCADE;


--
-- Name: notes notes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notes
    ADD CONSTRAINT notes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: projects projects_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;


--
-- Name: projects projects_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: projects projects_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: requirements requirements_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.requirements
    ADD CONSTRAINT requirements_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE CASCADE;


--
-- Name: system_features system_features_completed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_features
    ADD CONSTRAINT system_features_completed_by_fkey FOREIGN KEY (completed_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: system_features system_features_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_features
    ADD CONSTRAINT system_features_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE CASCADE;


--
-- Name: system_features system_features_system_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_features
    ADD CONSTRAINT system_features_system_id_fkey FOREIGN KEY (system_id) REFERENCES public.systems(id) ON DELETE CASCADE;


--
-- Name: systems systems_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.systems
    ADD CONSTRAINT systems_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE CASCADE;


--
-- Name: tags tags_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tags
    ADD CONSTRAINT tags_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: technical_variables technical_variables_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.technical_variables
    ADD CONSTRAINT technical_variables_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE CASCADE;


--
-- Name: timelines timelines_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.timelines
    ADD CONSTRAINT timelines_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE CASCADE;


--
-- Name: ai_usage_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_usage_log ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_usage_log ai_usage_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ai_usage_select ON public.ai_usage_log FOR SELECT USING ((organization_id = public.current_org_id()));


--
-- Name: app_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_logs audit_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY audit_insert ON public.audit_logs FOR INSERT WITH CHECK ((organization_id = public.current_org_id()));


--
-- Name: audit_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_logs audit_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY audit_select ON public.audit_logs FOR SELECT USING (((organization_id = public.current_org_id()) AND (public.current_role_of() = 'admin'::public.user_role)));


--
-- Name: checklist_comparisons checklist_cmp_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY checklist_cmp_delete ON public.checklist_comparisons FOR DELETE USING (((organization_id = public.current_org_id()) AND ((public.current_role_of() = ANY (ARRAY['admin'::public.user_role, 'supervisor'::public.user_role])) OR (created_by = auth.uid()))));


--
-- Name: checklist_comparisons checklist_cmp_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY checklist_cmp_insert ON public.checklist_comparisons FOR INSERT WITH CHECK (((organization_id = public.current_org_id()) AND public.can_read_document(document_id)));


--
-- Name: checklist_comparisons checklist_cmp_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY checklist_cmp_select ON public.checklist_comparisons FOR SELECT USING (((organization_id = public.current_org_id()) AND public.can_read_document(document_id)));


--
-- Name: checklist_comparisons; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.checklist_comparisons ENABLE ROW LEVEL SECURITY;

--
-- Name: document_chunks chunks_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY chunks_select ON public.document_chunks FOR SELECT USING (public.can_read_document(document_id));


--
-- Name: claim_responses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.claim_responses ENABLE ROW LEVEL SECURITY;

--
-- Name: claim_responses claim_responses_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY claim_responses_all ON public.claim_responses USING ((EXISTS ( SELECT 1
   FROM public.claims c
  WHERE ((c.id = claim_responses.claim_id) AND (c.organization_id = public.current_org_id())))));


--
-- Name: claims; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.claims ENABLE ROW LEVEL SECURITY;

--
-- Name: claims claims_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY claims_all ON public.claims USING ((organization_id = public.current_org_id())) WITH CHECK ((organization_id = public.current_org_id()));


--
-- Name: clients; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

--
-- Name: clients clients_insert_any; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY clients_insert_any ON public.clients FOR INSERT WITH CHECK ((organization_id = public.current_org_id()));


--
-- Name: clients clients_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY clients_select ON public.clients FOR SELECT USING ((organization_id = public.current_org_id()));


--
-- Name: clients clients_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY clients_write ON public.clients USING (((organization_id = public.current_org_id()) AND (public.current_role_of() = ANY (ARRAY['admin'::public.user_role, 'supervisor'::public.user_role]))));


--
-- Name: comparison_folders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.comparison_folders ENABLE ROW LEVEL SECURITY;

--
-- Name: comparison_folders comparison_folders_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY comparison_folders_delete ON public.comparison_folders FOR DELETE USING (((organization_id = public.current_org_id()) AND (public.current_role_of() = 'admin'::public.user_role)));


--
-- Name: comparison_folders comparison_folders_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY comparison_folders_insert ON public.comparison_folders FOR INSERT WITH CHECK ((organization_id = public.current_org_id()));


--
-- Name: comparison_folders comparison_folders_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY comparison_folders_select ON public.comparison_folders FOR SELECT USING ((organization_id = public.current_org_id()));


--
-- Name: comparison_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.comparison_items ENABLE ROW LEVEL SECURITY;

--
-- Name: comparison_items comparison_items_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY comparison_items_select ON public.comparison_items FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.comparisons c
  WHERE ((c.id = comparison_items.comparison_id) AND (c.organization_id = public.current_org_id()) AND public.can_read_document(c.source_document_id)))));


--
-- Name: comparisons; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.comparisons ENABLE ROW LEVEL SECURITY;

--
-- Name: comparisons comparisons_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY comparisons_insert ON public.comparisons FOR INSERT WITH CHECK ((organization_id = public.current_org_id()));


--
-- Name: comparisons comparisons_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY comparisons_select ON public.comparisons FOR SELECT USING (((organization_id = public.current_org_id()) AND public.can_read_document(source_document_id)));


--
-- Name: comparisons comparisons_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY comparisons_update ON public.comparisons FOR UPDATE USING (((organization_id = public.current_org_id()) AND public.can_read_document(source_document_id)));


--
-- Name: conversation_tags conv_tags_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY conv_tags_owner ON public.conversation_tags USING ((EXISTS ( SELECT 1
   FROM public.conversations c
  WHERE ((c.id = conversation_tags.conversation_id) AND (c.user_id = auth.uid())))));


--
-- Name: conversation_tags; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.conversation_tags ENABLE ROW LEVEL SECURITY;

--
-- Name: conversations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

--
-- Name: conversations conversations_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY conversations_owner ON public.conversations USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: delivered_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.delivered_items ENABLE ROW LEVEL SECURITY;

--
-- Name: delivered_items delivered_items_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY delivered_items_select ON public.delivered_items FOR SELECT USING (public.can_read_document(document_id));


--
-- Name: document_tags doc_tags_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY doc_tags_all ON public.document_tags USING (public.can_read_document(document_id));


--
-- Name: document_chunks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.document_chunks ENABLE ROW LEVEL SECURITY;

--
-- Name: document_metadata; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.document_metadata ENABLE ROW LEVEL SECURITY;

--
-- Name: document_pages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.document_pages ENABLE ROW LEVEL SECURITY;

--
-- Name: document_permissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.document_permissions ENABLE ROW LEVEL SECURITY;

--
-- Name: document_summaries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.document_summaries ENABLE ROW LEVEL SECURITY;

--
-- Name: document_tags; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.document_tags ENABLE ROW LEVEL SECURITY;

--
-- Name: document_versions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.document_versions ENABLE ROW LEVEL SECURITY;

--
-- Name: documents; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

--
-- Name: documents documents_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY documents_delete ON public.documents FOR DELETE USING (((organization_id = public.current_org_id()) AND ((public.current_role_of() = ANY (ARRAY['admin'::public.user_role, 'supervisor'::public.user_role])) OR (created_by = auth.uid()))));


--
-- Name: documents documents_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY documents_insert ON public.documents FOR INSERT WITH CHECK ((organization_id = public.current_org_id()));


--
-- Name: documents documents_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY documents_select ON public.documents FOR SELECT USING (((organization_id = public.current_org_id()) AND ((public.current_role_of() = ANY (ARRAY['admin'::public.user_role, 'supervisor'::public.user_role])) OR (created_by = auth.uid()) OR public.has_document_permission(id))));


--
-- Name: documents documents_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY documents_update ON public.documents FOR UPDATE USING (((organization_id = public.current_org_id()) AND ((public.current_role_of() = ANY (ARRAY['admin'::public.user_role, 'supervisor'::public.user_role])) OR (created_by = auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.document_permissions p
  WHERE ((p.document_id = documents.id) AND (p.user_id = auth.uid()) AND p.can_write))))));


--
-- Name: system_features features_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY features_select ON public.system_features FOR SELECT USING (public.can_read_document(document_id));


--
-- Name: system_features features_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY features_update ON public.system_features FOR UPDATE USING (public.can_read_document(document_id)) WITH CHECK (public.can_read_document(document_id));


--
-- Name: files; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;

--
-- Name: files files_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY files_insert ON public.files FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM (public.document_versions v
     JOIN public.documents d ON ((d.id = v.document_id)))
  WHERE ((v.id = files.version_id) AND (d.organization_id = public.current_org_id())))));


--
-- Name: files files_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY files_select ON public.files FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.document_versions v
  WHERE ((v.id = files.version_id) AND public.can_read_document(v.document_id)))));


--
-- Name: files files_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY files_update ON public.files FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM (public.document_versions v
     JOIN public.documents d ON ((d.id = v.document_id)))
  WHERE ((v.id = files.version_id) AND (d.organization_id = public.current_org_id())))));


--
-- Name: messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

--
-- Name: messages messages_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY messages_owner ON public.messages USING ((EXISTS ( SELECT 1
   FROM public.conversations c
  WHERE ((c.id = messages.conversation_id) AND (c.user_id = auth.uid())))));


--
-- Name: document_metadata metadata_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY metadata_select ON public.document_metadata FOR SELECT USING (public.can_read_document(document_id));


--
-- Name: milestones; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.milestones ENABLE ROW LEVEL SECURITY;

--
-- Name: milestones milestones_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY milestones_select ON public.milestones FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.timelines t
  WHERE ((t.id = milestones.timeline_id) AND public.can_read_document(t.document_id)))));


--
-- Name: note_attachments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.note_attachments ENABLE ROW LEVEL SECURITY;

--
-- Name: note_attachments note_attachments_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY note_attachments_delete ON public.note_attachments FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.notes n
  WHERE ((n.id = note_attachments.note_id) AND (n.user_id = auth.uid())))));


--
-- Name: note_attachments note_attachments_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY note_attachments_insert ON public.note_attachments FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.notes n
  WHERE ((n.id = note_attachments.note_id) AND (n.user_id = auth.uid())))));


--
-- Name: note_attachments note_attachments_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY note_attachments_select ON public.note_attachments FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.notes n
  WHERE ((n.id = note_attachments.note_id) AND public.can_read_document(n.document_id)))));


--
-- Name: notes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

--
-- Name: notes notes_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notes_delete ON public.notes FOR DELETE USING ((user_id = auth.uid()));


--
-- Name: notes notes_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notes_select ON public.notes FOR SELECT USING (public.can_read_document(document_id));


--
-- Name: notes notes_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notes_update ON public.notes FOR UPDATE USING ((user_id = auth.uid()));


--
-- Name: notes notes_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notes_write ON public.notes FOR INSERT WITH CHECK (((user_id = auth.uid()) AND public.can_read_document(document_id)));


--
-- Name: organizations org_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY org_select ON public.organizations FOR SELECT USING ((id = public.current_org_id()));


--
-- Name: organizations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

--
-- Name: document_pages pages_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pages_select ON public.document_pages FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.document_versions v
  WHERE ((v.id = document_pages.version_id) AND public.can_read_document(v.document_id)))));


--
-- Name: document_permissions perms_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY perms_select ON public.document_permissions FOR SELECT USING (((user_id = auth.uid()) OR ((public.current_role_of() = ANY (ARRAY['admin'::public.user_role, 'supervisor'::public.user_role])) AND (EXISTS ( SELECT 1
   FROM public.documents d
  WHERE ((d.id = document_permissions.document_id) AND (d.organization_id = public.current_org_id())))))));


--
-- Name: document_permissions perms_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY perms_write ON public.document_permissions USING (((public.current_role_of() = ANY (ARRAY['admin'::public.user_role, 'supervisor'::public.user_role])) AND (EXISTS ( SELECT 1
   FROM public.documents d
  WHERE ((d.id = document_permissions.document_id) AND (d.organization_id = public.current_org_id()))))));


--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles profiles_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_admin_all ON public.profiles USING (((organization_id = public.current_org_id()) AND (public.current_role_of() = 'admin'::public.user_role)));


--
-- Name: profiles profiles_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_select ON public.profiles FOR SELECT USING ((organization_id = public.current_org_id()));


--
-- Name: profiles profiles_update_self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_update_self ON public.profiles FOR UPDATE USING ((id = auth.uid()));


--
-- Name: projects; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

--
-- Name: projects projects_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY projects_delete ON public.projects FOR DELETE USING (((organization_id = public.current_org_id()) AND (public.current_role_of() = 'admin'::public.user_role)));


--
-- Name: projects projects_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY projects_insert ON public.projects FOR INSERT WITH CHECK ((organization_id = public.current_org_id()));


--
-- Name: projects projects_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY projects_select ON public.projects FOR SELECT USING ((organization_id = public.current_org_id()));


--
-- Name: projects projects_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY projects_update ON public.projects FOR UPDATE USING (((organization_id = public.current_org_id()) AND ((public.current_role_of() = ANY (ARRAY['admin'::public.user_role, 'supervisor'::public.user_role])) OR (created_by = auth.uid()))));


--
-- Name: requirements reqs_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY reqs_select ON public.requirements FOR SELECT USING (public.can_read_document(document_id));


--
-- Name: requirements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.requirements ENABLE ROW LEVEL SECURITY;

--
-- Name: app_settings settings_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY settings_select ON public.app_settings FOR SELECT USING ((organization_id = public.current_org_id()));


--
-- Name: app_settings settings_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY settings_write ON public.app_settings USING (((organization_id = public.current_org_id()) AND (public.current_role_of() = 'admin'::public.user_role)));


--
-- Name: document_summaries summaries_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY summaries_select ON public.document_summaries FOR SELECT USING (public.can_read_document(document_id));


--
-- Name: system_features; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.system_features ENABLE ROW LEVEL SECURITY;

--
-- Name: systems; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.systems ENABLE ROW LEVEL SECURITY;

--
-- Name: systems systems_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY systems_select ON public.systems FOR SELECT USING (public.can_read_document(document_id));


--
-- Name: tags; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;

--
-- Name: tags tags_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tags_select ON public.tags FOR SELECT USING ((organization_id = public.current_org_id()));


--
-- Name: tags tags_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tags_write ON public.tags USING ((organization_id = public.current_org_id()));


--
-- Name: technical_variables; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.technical_variables ENABLE ROW LEVEL SECURITY;

--
-- Name: technical_variables techvars_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY techvars_select ON public.technical_variables FOR SELECT USING (public.can_read_document(document_id));


--
-- Name: timelines; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.timelines ENABLE ROW LEVEL SECURITY;

--
-- Name: timelines timelines_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY timelines_select ON public.timelines FOR SELECT USING (public.can_read_document(document_id));


--
-- Name: document_versions versions_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY versions_insert ON public.document_versions FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.documents d
  WHERE ((d.id = document_versions.document_id) AND (d.organization_id = public.current_org_id())))));


--
-- Name: document_versions versions_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY versions_select ON public.document_versions FOR SELECT USING (public.can_read_document(document_id));


--
-- Name: document_versions versions_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY versions_update ON public.document_versions FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.documents d
  WHERE ((d.id = document_versions.document_id) AND (d.organization_id = public.current_org_id())))));


--
-- PostgreSQL database dump complete
--

\unrestrict NLgcznxTaJjj9hgVk8RcsOCrOVBkaNbYedlaRrh73MfqvFZunkP7Iqg4pYoVUn4

