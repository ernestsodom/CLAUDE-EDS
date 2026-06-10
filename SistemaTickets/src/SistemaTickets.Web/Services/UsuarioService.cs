using SistemaTickets.Domain.DTOs;
using SistemaTickets.Domain.Entities;
using SistemaTickets.Infrastructure.Repositories;

namespace SistemaTickets.Web.Services;

public class UsuarioService(IUsuarioRepository usuarioRepo)
{
    public Task<List<Usuario>> ObtenerTodosAsync() => usuarioRepo.ObtenerTodosAsync();

    public Task<Usuario?> ObtenerPorIdAsync(int id) => usuarioRepo.ObtenerPorIdAsync(id);

    public async Task<Usuario> CrearAsync(CrearUsuarioDto dto)
    {
        var usuario = new Usuario
        {
            Nombre = dto.Nombre,
            Correo = dto.Correo.ToLower(),
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password),
            Rol = dto.Rol
        };
        return await usuarioRepo.CrearAsync(usuario);
    }

    public async Task ActualizarAsync(int id, string nombre, string correo)
    {
        var usuario = await usuarioRepo.ObtenerPorIdAsync(id)
            ?? throw new InvalidOperationException("Usuario no encontrado.");

        usuario.Nombre = nombre;
        usuario.Correo = correo.ToLower();
        await usuarioRepo.ActualizarAsync(usuario);
    }

    public async Task ToggleActivoAsync(int id)
    {
        var usuario = await usuarioRepo.ObtenerPorIdAsync(id)
            ?? throw new InvalidOperationException("Usuario no encontrado.");

        usuario.Activo = !usuario.Activo;
        await usuarioRepo.ActualizarAsync(usuario);
    }

    public async Task CambiarPasswordAsync(int id, string nuevaPassword)
    {
        var usuario = await usuarioRepo.ObtenerPorIdAsync(id)
            ?? throw new InvalidOperationException("Usuario no encontrado.");

        usuario.PasswordHash = BCrypt.Net.BCrypt.HashPassword(nuevaPassword);
        await usuarioRepo.ActualizarAsync(usuario);
    }
}
