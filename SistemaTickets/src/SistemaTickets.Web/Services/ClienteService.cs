using SistemaTickets.Domain.DTOs;
using SistemaTickets.Domain.Entities;
using SistemaTickets.Infrastructure.Repositories;

namespace SistemaTickets.Web.Services;

public class ClienteService(IClienteRepository clienteRepo)
{
    public Task<List<Cliente>> ObtenerTodosAsync() => clienteRepo.ObtenerTodosAsync();

    public Task<Cliente?> ObtenerPorIdAsync(int id) => clienteRepo.ObtenerPorIdAsync(id);

    public async Task<Cliente> CrearAsync(CrearClienteDto dto)
    {
        var cliente = new Cliente
        {
            Nombre = dto.Nombre,
            Correo = dto.Correo,
            Telefono = dto.Telefono,
            Empresa = dto.Empresa
        };
        return await clienteRepo.CrearAsync(cliente);
    }

    public async Task ActualizarAsync(int id, CrearClienteDto dto)
    {
        var cliente = await clienteRepo.ObtenerPorIdAsync(id)
            ?? throw new InvalidOperationException("Cliente no encontrado.");

        cliente.Nombre = dto.Nombre;
        cliente.Correo = dto.Correo;
        cliente.Telefono = dto.Telefono;
        cliente.Empresa = dto.Empresa;
        await clienteRepo.ActualizarAsync(cliente);
    }

    public async Task ToggleActivoAsync(int id)
    {
        var cliente = await clienteRepo.ObtenerPorIdAsync(id)
            ?? throw new InvalidOperationException("Cliente no encontrado.");

        cliente.Activo = !cliente.Activo;
        await clienteRepo.ActualizarAsync(cliente);
    }
}
