using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using SistemaTickets.Domain.Entities;
using SistemaTickets.Infrastructure.Repositories;

namespace SistemaTickets.Web.Services;

public class AuthService(IUsuarioRepository usuarioRepo, IHttpContextAccessor httpContextAccessor)
{
    public async Task<bool> LoginAsync(string correo, string password)
    {
        var usuario = await usuarioRepo.ObtenerPorCorreoAsync(correo);
        if (usuario is null || !usuario.Activo) return false;
        if (!BCrypt.Net.BCrypt.Verify(password, usuario.PasswordHash)) return false;

        var claims = BuildClaims(usuario);
        var identity = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);
        var principal = new ClaimsPrincipal(identity);

        var ctx = httpContextAccessor.HttpContext!;
        await ctx.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme, principal);
        return true;
    }

    public static int? ObtenerUsuarioId(ClaimsPrincipal user)
    {
        var idStr = user.FindFirstValue(ClaimTypes.NameIdentifier);
        return int.TryParse(idStr, out var id) ? id : null;
    }

    private static List<Claim> BuildClaims(Usuario usuario) =>
    [
        new Claim(ClaimTypes.NameIdentifier, usuario.Id.ToString()),
        new Claim(ClaimTypes.Name, usuario.Nombre),
        new Claim(ClaimTypes.Email, usuario.Correo),
        new Claim(ClaimTypes.Role, usuario.Rol.ToString())
    ];
}
