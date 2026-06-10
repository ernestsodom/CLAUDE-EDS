using Microsoft.EntityFrameworkCore;
using SistemaTickets.Domain.Entities;

namespace SistemaTickets.Infrastructure.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<Usuario> Usuarios => Set<Usuario>();
    public DbSet<Cliente> Clientes => Set<Cliente>();
    public DbSet<Ticket> Tickets => Set<Ticket>();
    public DbSet<TicketSeguimiento> TicketSeguimientos => Set<TicketSeguimiento>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<Usuario>(e =>
        {
            e.HasIndex(u => u.Correo).IsUnique();
            e.Property(u => u.Nombre).HasMaxLength(150).IsRequired();
            e.Property(u => u.Correo).HasMaxLength(200).IsRequired();
            e.Property(u => u.PasswordHash).HasMaxLength(500).IsRequired();
        });

        modelBuilder.Entity<Cliente>(e =>
        {
            e.Property(c => c.Nombre).HasMaxLength(150).IsRequired();
            e.Property(c => c.Correo).HasMaxLength(200);
            e.Property(c => c.Telefono).HasMaxLength(50);
            e.Property(c => c.Empresa).HasMaxLength(150);
        });

        modelBuilder.Entity<Ticket>(e =>
        {
            e.Property(t => t.Titulo).HasMaxLength(300).IsRequired();
            e.Property(t => t.Descripcion).HasMaxLength(4000).IsRequired();

            e.HasOne(t => t.Cliente)
             .WithMany(c => c.Tickets)
             .HasForeignKey(t => t.ClienteId)
             .OnDelete(DeleteBehavior.Restrict);

            e.HasOne(t => t.CreadoPor)
             .WithMany(u => u.TicketsCreados)
             .HasForeignKey(t => t.CreadoPorId)
             .OnDelete(DeleteBehavior.Restrict);

            e.HasOne(t => t.AsignadoA)
             .WithMany(u => u.TicketsAsignados)
             .HasForeignKey(t => t.AsignadoAId)
             .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<TicketSeguimiento>(e =>
        {
            e.Property(s => s.Comentario).HasMaxLength(4000).IsRequired();

            e.HasOne(s => s.Ticket)
             .WithMany(t => t.Seguimientos)
             .HasForeignKey(s => s.TicketId)
             .OnDelete(DeleteBehavior.Cascade);

            e.HasOne(s => s.Usuario)
             .WithMany(u => u.Seguimientos)
             .HasForeignKey(s => s.UsuarioId)
             .OnDelete(DeleteBehavior.Restrict);
        });
    }
}
