using Microsoft.EntityFrameworkCore;
using SistemaTickets.Domain.Entities;
using SistemaTickets.Domain.Enums;

namespace SistemaTickets.Infrastructure.Data;

public static class DbSeeder
{
    public static async Task SeedAsync(AppDbContext db)
    {
        await db.Database.MigrateAsync();

        if (await db.Usuarios.AnyAsync()) return;

        var admin = new Usuario
        {
            Nombre = "Administrador",
            Correo = "admin@empresa.com",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("Admin123!"),
            Rol = RolUsuario.Administrador,
            Activo = true
        };

        var dev = new Usuario
        {
            Nombre = "Desarrollador",
            Correo = "dev@empresa.com",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("Dev123!"),
            Rol = RolUsuario.Desarrollador,
            Activo = true
        };

        db.Usuarios.AddRange(admin, dev);

        var cliente = new Cliente
        {
            Nombre = "Cliente Demo",
            Correo = "contacto@clientedemo.com",
            Empresa = "Empresa Demo S.A.",
            Activo = true
        };

        db.Clientes.Add(cliente);
        await db.SaveChangesAsync();

        var ticket = new Ticket
        {
            Titulo = "Ticket de prueba inicial",
            Descripcion = "Este es el primer ticket del sistema creado automáticamente.",
            Estado = EstadoTicket.Abierto,
            Prioridad = PrioridadTicket.Media,
            ClienteId = cliente.Id,
            CreadoPorId = admin.Id,
            AsignadoAId = dev.Id
        };

        db.Tickets.Add(ticket);
        await db.SaveChangesAsync();
    }
}
