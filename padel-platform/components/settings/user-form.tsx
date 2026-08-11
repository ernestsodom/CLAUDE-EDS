'use client';

import { saveUser } from '@/actions/users';
import { EntityForm } from '@/components/forms/entity-form';
import {
  CheckboxField, FormGrid, FormSection, SelectField, TextField,
} from '@/components/forms';
import type { Option } from '@/lib/services/options';

export interface UserRecord {
  id: string;
  full_name: string | null;
  email: string;
  phone: string | null;
  job_title: string | null;
  active: boolean;
  role_id: string | null;
}

export function UserForm({
  projectCode,
  record,
  roles,
  cancelHref,
}: {
  projectCode: string;
  record: UserRecord | null;
  roles: Option[];
  cancelHref: string;
}) {
  return (
    <EntityForm action={saveUser} projectCode={projectCode} id={record?.id} cancelHref={cancelHref}>
      <FormSection title="Datos del usuario">
        <FormGrid>
          <TextField name="full_name" label="Nombre completo" required
            defaultValue={record?.full_name} placeholder="Ana Garcia" />
          <TextField name="email" label="Email" type="email" required
            defaultValue={record?.email} placeholder="ana@empresa.com" />
          <TextField name="phone" label="Telefono" defaultValue={record?.phone} />
          <TextField name="job_title" label="Cargo" defaultValue={record?.job_title} />
          <SelectField name="role_id" label="Rol en este proyecto" required allowEmpty={false}
            defaultValue={record?.role_id} options={roles} />
        </FormGrid>
        <div className="mt-4">
          <CheckboxField name="active" label="Usuario activo"
            hint="Un usuario inactivo no puede iniciar sesion en este proyecto."
            defaultChecked={record?.active ?? true} />
        </div>
      </FormSection>

      {!record ? (
        <FormSection title="Acceso inicial" description="Se usara para el primer inicio de sesion; el usuario podra cambiarla despues.">
          <FormGrid cols={1}>
            <TextField name="password" label="Contrasena" type="password" required
              placeholder="Minimo 8 caracteres" />
          </FormGrid>
        </FormSection>
      ) : (
        <p className="border-t border-line pt-4 text-2xs text-content-muted">
          Para cambiar la contrasena de este usuario, usa el boton de llave en el listado de
          usuarios.
        </p>
      )}
    </EntityForm>
  );
}
