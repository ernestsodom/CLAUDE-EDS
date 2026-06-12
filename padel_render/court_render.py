"""
Render profesional de cancha de padel panoramica — Blender (headless, Cycles)
Diseno: estructura negro mate, lineas blancas, acentos naranjo fluor.
Dimensiones reglamentarias FIP: 20m x 10m, vidrio 3m, malla hasta 4m en
fondos/esquinas, red 0.88m, lineas de saque a 6.95m del eje de la red.

Uso:
  blender -b -P court_render.py -- <res_x> <res_y> <samples> <out.png> [day|night] [cam]
  python court_render.py <res_x> <res_y> <samples> <out.png> [day|night] [cam]
"""
import bpy
import bmesh
import math
import sys

# ----------------------------------------------------------------------------
# Parametros CLI
# ----------------------------------------------------------------------------
if "--" in sys.argv:
    argv = sys.argv[sys.argv.index("--") + 1:]
else:
    argv = sys.argv[1:]
RES_X = int(argv[0]) if len(argv) > 0 else 960
RES_Y = int(argv[1]) if len(argv) > 1 else 672
SAMPLES = int(argv[2]) if len(argv) > 2 else 64
OUTPATH = argv[3] if len(argv) > 3 else "/tmp/padel.png"
NIGHT = (len(argv) > 4 and argv[4] == "night")
CAM = argv[5] if len(argv) > 5 else "hero"

# ----------------------------------------------------------------------------
# Constantes de la cancha (metros)
# ----------------------------------------------------------------------------
L, W = 20.0, 10.0                  # area de juego
HX, HY = L / 2, W / 2              # 10, 5
WALL_X = HX + 0.03                 # plano de muros fondo
WALL_Y = HY + 0.03                 # plano de muros laterales
SLAB_TOP = 0.07                    # losa base
TURF_TOP = 0.084                   # superficie cesped
H_GLASS = 3.0                      # altura vidrio
H_TOP = 4.0                        # altura total fondos/esquinas
Z3 = SLAB_TOP + H_GLASS
Z4 = SLAB_TOP + H_TOP
MESH_STEP = 0.05                   # paso malla 50x50mm
WIRE = 0.007                       # grosor alambre (sobredimensionado para
                                   # legibilidad a distancia de camara)
DOOR_HALF = 1.15                   # media apertura de acceso (puerta unica 2.3m)
DOOR_H = SLAB_TOP + 2.05           # altura apertura
GLASS_T = 0.012                    # vidrio templado 12mm

C = bpy.context

# ----------------------------------------------------------------------------
# Escena limpia
# ----------------------------------------------------------------------------
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = C.scene
scene.unit_settings.system = 'METRIC'


# ----------------------------------------------------------------------------
# Materiales
# ----------------------------------------------------------------------------
def set_in(node, names, value):
    """Asigna un input de nodo probando nombres de distintas versiones."""
    for n in names:
        if n in node.inputs:
            node.inputs[n].default_value = value
            return True
    return False


def new_mat(name):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes["Principled BSDF"]
    return m, bsdf


def mat_black_steel():
    m, b = new_mat("black_steel")
    set_in(b, ["Base Color"], (0.012, 0.012, 0.013, 1))
    set_in(b, ["Metallic"], 0.35)
    set_in(b, ["Roughness"], 0.42)
    set_in(b, ["Specular IOR Level", "Specular"], 0.5)
    return m


def mat_mesh_metal():
    m, b = new_mat("mesh_metal")
    set_in(b, ["Base Color"], (0.018, 0.018, 0.02, 1))
    set_in(b, ["Metallic"], 0.75)
    set_in(b, ["Roughness"], 0.38)
    return m


def mat_orange():
    m, b = new_mat("fluor_orange")
    col = (1.0, 0.17, 0.0, 1)
    set_in(b, ["Base Color"], col)
    set_in(b, ["Roughness"], 0.38)
    set_in(b, ["Metallic"], 0.0)
    set_in(b, ["Emission Color", "Emission"], col)
    set_in(b, ["Emission Strength"], 0.5 if not NIGHT else 1.4)
    return m


def mat_white():
    m, b = new_mat("white_paint")
    set_in(b, ["Base Color"], (0.86, 0.86, 0.86, 1))
    set_in(b, ["Roughness"], 0.55)
    return m


def mat_turf():
    m, b = new_mat("black_turf")
    nt = m.node_tree
    set_in(b, ["Base Color"], (0.011, 0.011, 0.012, 1))
    set_in(b, ["Roughness"], 0.86)
    set_in(b, ["Specular IOR Level", "Specular"], 0.08)
    set_in(b, ["Sheen Weight", "Sheen"], 0.12)
    # fibras: ruido fino como bump
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 220.0
    noise.inputs["Detail"].default_value = 4.0
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.18
    bump.inputs["Distance"].default_value = 0.004
    nt.links.new(noise.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], b.inputs["Normal"])
    # arena de silice: chispas claras sutiles
    spec = nt.nodes.new("ShaderNodeTexNoise")
    spec.inputs["Scale"].default_value = 1400.0
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = 0.665
    ramp.color_ramp.elements[1].position = 0.71
    mix = nt.nodes.new("ShaderNodeMixRGB")
    mix.blend_type = 'MIX'
    mix.inputs["Color1"].default_value = (0.011, 0.011, 0.012, 1)
    mix.inputs["Color2"].default_value = (0.14, 0.14, 0.15, 1)
    nt.links.new(spec.outputs["Fac"], ramp.inputs["Fac"])
    mul = nt.nodes.new("ShaderNodeMath")
    mul.operation = 'MULTIPLY'
    mul.inputs[1].default_value = 0.3
    nt.links.new(ramp.outputs["Color"], mul.inputs[0])
    nt.links.new(mul.outputs["Value"], mix.inputs["Fac"])
    nt.links.new(mix.outputs["Color"], b.inputs["Base Color"])
    return m


def mat_glass():
    m = bpy.data.materials.new("glass12mm")
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    glass = nt.nodes.new("ShaderNodeBsdfGlass")
    glass.inputs["Color"].default_value = (0.88, 0.93, 0.92, 1)
    glass.inputs["Roughness"].default_value = 0.004
    glass.inputs["IOR"].default_value = 1.45
    transp = nt.nodes.new("ShaderNodeBsdfTransparent")
    lp = nt.nodes.new("ShaderNodeLightPath")
    mix = nt.nodes.new("ShaderNodeMixShader")
    nt.links.new(lp.outputs["Is Shadow Ray"], mix.inputs["Fac"])
    nt.links.new(glass.outputs["BSDF"], mix.inputs[1])
    nt.links.new(transp.outputs["BSDF"], mix.inputs[2])
    nt.links.new(mix.outputs["Shader"], out.inputs["Surface"])
    return m


def mat_floor():
    m, b = new_mat("studio_floor")
    set_in(b, ["Base Color"], (0.78, 0.785, 0.795, 1))
    set_in(b, ["Roughness"], 0.26)
    set_in(b, ["Specular IOR Level", "Specular"], 0.5)
    return m


def mat_slab():
    m, b = new_mat("slab")
    set_in(b, ["Base Color"], (0.015, 0.015, 0.016, 1))
    set_in(b, ["Roughness"], 0.6)
    return m


def mat_led():
    m = bpy.data.materials.new("led")
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    em = nt.nodes.new("ShaderNodeEmission")
    em.inputs["Color"].default_value = (1.0, 0.97, 0.92, 1)
    em.inputs["Strength"].default_value = 60.0 if NIGHT else 6.0
    nt.links.new(em.outputs["Emission"], out.inputs["Surface"])
    return m


def mat_net():
    m, b = new_mat("net_cord")
    set_in(b, ["Base Color"], (0.01, 0.01, 0.011, 1))
    set_in(b, ["Roughness"], 0.7)
    return m


M_STEEL = mat_black_steel()
M_MESH = mat_mesh_metal()
M_ORANGE = mat_orange()
M_WHITE = mat_white()
M_TURF = mat_turf()
M_GLASS = mat_glass()
M_FLOOR = mat_floor()
M_SLAB = mat_slab()
M_LED = mat_led()
M_NET = mat_net()


# ----------------------------------------------------------------------------
# Helpers de geometria
# ----------------------------------------------------------------------------
def boxes_mesh(name, boxes, mat):
    """Crea un solo mesh con muchas cajas. boxes: (cx,cy,cz,sx,sy,sz)."""
    verts, faces = [], []
    for (cx, cy, cz, sx, sy, sz) in boxes:
        x0, x1 = cx - sx / 2, cx + sx / 2
        y0, y1 = cy - sy / 2, cy + sy / 2
        z0, z1 = cz - sz / 2, cz + sz / 2
        b = len(verts)
        verts += [(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0),
                  (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)]
        faces += [(b, b + 3, b + 2, b + 1), (b + 4, b + 5, b + 6, b + 7),
                  (b, b + 1, b + 5, b + 4), (b + 1, b + 2, b + 6, b + 5),
                  (b + 2, b + 3, b + 7, b + 6), (b + 3, b, b + 4, b + 7)]
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()
    me.update()
    ob = bpy.data.objects.new(name, me)
    C.collection.objects.link(ob)
    if mat:
        ob.data.materials.append(mat)
    return ob


def box(name, cx, cy, cz, sx, sy, sz, mat):
    return boxes_mesh(name, [(cx, cy, cz, sx, sy, sz)], mat)


def cyl(name, r, depth, loc, rot, mat, verts=24):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=depth, vertices=verts,
                                        location=loc, rotation=rot)
    ob = C.active_object
    ob.name = name
    ob.data.materials.append(mat)
    return ob


def sphere(name, r, loc, mat):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, location=loc,
                                         segments=20, ring_count=12)
    ob = C.active_object
    ob.name = name
    bpy.ops.object.shade_smooth()
    ob.data.materials.append(mat)
    return ob


def wire_panel(name, axis, fixed, u0, u1, z0, z1, mat=None):
    """Panel de malla electrosoldada en plano vertical.
    axis 'x': panel paralelo a eje x (muro lateral, y=fixed), u=x.
    axis 'y': panel paralelo a eje y (muro de fondo, x=fixed), u=y."""
    mat = mat or M_MESH
    bxs = []
    n_u = max(1, int(round((u1 - u0) / MESH_STEP)))
    n_z = max(1, int(round((z1 - z0) / MESH_STEP)))
    # alambres verticales
    for i in range(n_u + 1):
        u = u0 + (u1 - u0) * i / n_u
        if axis == 'x':
            bxs.append((u, fixed, (z0 + z1) / 2, WIRE, WIRE, z1 - z0))
        else:
            bxs.append((fixed, u, (z0 + z1) / 2, WIRE, WIRE, z1 - z0))
    # alambres horizontales
    for j in range(n_z + 1):
        z = z0 + (z1 - z0) * j / n_z
        if axis == 'x':
            bxs.append(((u0 + u1) / 2, fixed, z, u1 - u0, WIRE * 1.2, WIRE))
        else:
            bxs.append((fixed, (u0 + u1) / 2, z, WIRE * 1.2, u1 - u0, WIRE))
    return boxes_mesh(name, bxs, mat)


# ----------------------------------------------------------------------------
# Piso de estudio, losa y cesped
# ----------------------------------------------------------------------------
box("studio_floor", 0, 0, -0.05, 400, 400, 0.1, M_FLOOR)
box("slab", 0, 0, SLAB_TOP / 2, L + 0.7, W + 0.7, SLAB_TOP, M_SLAB)
box("turf", 0, 0, (SLAB_TOP + TURF_TOP) / 2, L + 0.05, W + 0.05,
    TURF_TOP - SLAB_TOP, M_TURF)

# zocalo perimetral negro (remate cesped-muro)
kick = []
for sy in (-1, 1):
    kick.append((0, sy * WALL_Y, TURF_TOP + 0.05, L + 0.1, 0.025, 0.1))
for sx in (-1, 1):
    kick.append((sx * WALL_X, 0, TURF_TOP + 0.05, 0.025, W + 0.1, 0.1))
boxes_mesh("kick_plate", kick, M_STEEL)

# ----------------------------------------------------------------------------
# Lineas reglamentarias blancas (50mm)
# ----------------------------------------------------------------------------
LZ = TURF_TOP + 0.0015
lines = [
    (6.95, 0, LZ, 0.05, W, 0.003),          # linea de saque
    (-6.95, 0, LZ, 0.05, W, 0.003),         # linea de saque
    (0, 0, LZ, 13.9 + 0.05, 0.05, 0.003),   # linea central de saque
]
# la linea central se dibuja en dos mitades para no cruzar bajo la red: ok cruzarla
boxes_mesh("court_lines", lines, M_WHITE)

# ----------------------------------------------------------------------------
# Vidrios panoramicos: fondos (5 panos de 2m) + esquinas laterales (2m)
# ----------------------------------------------------------------------------
glass = []
GAP = 0.012
for sx in (-1, 1):
    for i in range(5):
        y_c = -HY + 1.0 + 2.0 * i
        glass.append((sx * WALL_X, y_c, SLAB_TOP + H_GLASS / 2,
                      GLASS_T, 2.0 - GAP, H_GLASS - 0.015))
for sy in (-1, 1):
    for sx in (-1, 1):
        x_c = sx * (HX - 1.0)
        glass.append((x_c, sy * WALL_Y, SLAB_TOP + H_GLASS / 2,
                      2.0 - GAP, GLASS_T, H_GLASS - 0.015))
boxes_mesh("glass_panels", glass, M_GLASS)

# fijaciones puntuales (botones negros) en juntas de vidrio de fondo
for sx in (-1, 1):
    for yj in (-3.0, -1.0, 1.0, 3.0):
        for zj in (0.45, 1.55, 2.65):
            cyl("btn", 0.026, 0.022, (sx * WALL_X, yj, SLAB_TOP + zj),
                (0, math.pi / 2, 0), M_STEEL, verts=16)

# ----------------------------------------------------------------------------
# Malla metalica
# ----------------------------------------------------------------------------
for sy in (-1, 1):
    wy = sy * WALL_Y
    # tramos centrales laterales (3m) con UNA apertura amplia junto a la red
    wire_panel(f"mesh_side_a{sy}", 'x', wy, -HX + 2.0, -DOOR_HALF, SLAB_TOP, Z3)
    wire_panel(f"mesh_side_b{sy}", 'x', wy, DOOR_HALF, HX - 2.0, SLAB_TOP, Z3)
    # dintel enrejado sobre la apertura
    wire_panel(f"mesh_door_t{sy}", 'x', wy, -DOOR_HALF, DOOR_HALF, DOOR_H, Z3)
    # franja 3-4m sobre vidrio de esquinas
    wire_panel(f"mesh_cor_a{sy}", 'x', wy, -HX, -HX + 2.0, Z3, Z4)
    wire_panel(f"mesh_cor_b{sy}", 'x', wy, HX - 2.0, HX, Z3, Z4)
for sx in (-1, 1):
    # franja 3-4m sobre vidrio de fondos
    wire_panel(f"mesh_back{sx}", 'y', sx * WALL_X, -HY, HY, Z3, Z4)

# ----------------------------------------------------------------------------
# Estructura: postes, rieles y marcos
# ----------------------------------------------------------------------------
posts = []
PS = 0.08
for sy in (-1, 1):
    wy = sy * WALL_Y
    for px in (-8, -6, -4, -2, 2, 4, 6, 8):
        h = Z4 if abs(px) == 8 else Z3
        posts.append((px, wy, (SLAB_TOP + h) / 2, PS, PS, h - SLAB_TOP))
for sx in (-1, 1):
    for sy in (-1, 1):
        posts.append((sx * WALL_X, sy * WALL_Y, (SLAB_TOP + Z4) / 2,
                      PS, PS, Z4 - SLAB_TOP))
# montantes esbeltos sobre vidrio de fondo (sujetan franja de malla)
for sx in (-1, 1):
    for yj in (-3.0, -1.0, 1.0, 3.0):
        posts.append((sx * WALL_X, yj, (Z3 + Z4) / 2, 0.04, 0.04, Z4 - Z3))
boxes_mesh("posts", posts, M_STEEL)

# tapas naranjo fluor en postes de esquina
caps = []
for sx in (-1, 1):
    for sy in (-1, 1):
        caps.append((sx * WALL_X, sy * WALL_Y, Z4 + 0.035, PS + 0.012,
                     PS + 0.012, 0.07))
boxes_mesh("post_caps", caps, M_ORANGE)

# riel perimetral NARANJO FLUOR a 3m (firma del diseno)
RR = 0.034
for sy in (-1, 1):
    cyl(f"rail_o_side{sy}", RR, L + 0.06, (0, sy * WALL_Y, Z3),
        (0, math.pi / 2, 0), M_ORANGE)
for sx in (-1, 1):
    cyl(f"rail_o_back{sx}", RR, W + 0.06, (sx * WALL_X, 0, Z3),
        (math.pi / 2, 0, 0), M_ORANGE)
for sx in (-1, 1):
    for sy in (-1, 1):
        sphere("rail_corner", RR, (sx * WALL_X, sy * WALL_Y, Z3), M_ORANGE)

# remate superior negro a 4m (fondos y esquinas laterales)
RT = 0.025
for sx in (-1, 1):
    cyl(f"rail_t_back{sx}", RT, W + 0.06, (sx * WALL_X, 0, Z4),
        (math.pi / 2, 0, 0), M_STEEL)
for sy in (-1, 1):
    for sx in (-1, 1):
        cyl(f"rail_t_cor{sx}{sy}", RT, 2.0 + 0.06,
            (sx * (HX - 1.0), sy * WALL_Y, Z4), (0, math.pi / 2, 0), M_STEEL)

# marco de acceso naranjo fluor: una sola puerta amplia por lado
frames = []
FT = 0.07
for sy in (-1, 1):
    wy = sy * WALL_Y
    for xj in (-DOOR_HALF, DOOR_HALF):
        frames.append((xj, wy, (SLAB_TOP + DOOR_H) / 2, FT, FT,
                       DOOR_H - SLAB_TOP))
    frames.append((0, wy, DOOR_H, 2 * DOOR_HALF + FT, FT, FT))
boxes_mesh("door_frames", frames, M_ORANGE)

# ----------------------------------------------------------------------------
# Red reglamentaria
# ----------------------------------------------------------------------------
NET_TOP = TURF_TOP + 0.88
cords = []
ny = int(W / 0.04)
for i in range(ny + 1):
    y = -HY + W * i / ny
    cords.append((0, y, (TURF_TOP + NET_TOP - 0.06) / 2, 0.006, 0.006,
                  NET_TOP - 0.06 - TURF_TOP))
nz = int((NET_TOP - 0.06 - TURF_TOP) / 0.04)
for j in range(nz + 1):
    z = TURF_TOP + (NET_TOP - 0.06 - TURF_TOP) * j / nz
    cords.append((0, 0, z, 0.006, W, 0.006))
boxes_mesh("net_cords", cords, M_NET)
# banda superior blanca + cinta central
box("net_band", 0, 0, NET_TOP - 0.03, 0.024, W, 0.06, M_WHITE)
box("net_strap", 0.013, 0, (TURF_TOP + NET_TOP) / 2, 0.004, 0.05,
    NET_TOP - TURF_TOP, M_WHITE)
# postes de red negros con tapa naranja
for sy in (-1, 1):
    cyl(f"net_post{sy}", 0.045, 0.94, (0, sy * (HY - 0.05), TURF_TOP + 0.47),
        (0, 0, 0), M_STEEL)
    cyl(f"net_cap{sy}", 0.047, 0.05, (0, sy * (HY - 0.05), TURF_TOP + 0.955),
        (0, 0, 0), M_ORANGE)

# ----------------------------------------------------------------------------
# Iluminacion: 4 brazos curvos que nacen de la estructura (postes x=+-6)
# ----------------------------------------------------------------------------
POLE_X = (-6.0, 6.0)
ARM_RISE = 2.25            # cota de arranque del brazo sobre el poste
HEAD_Z = 6.05


def light_pole(x, side):
    """Brazo curvo montado al poste estructural. side=1 -> muro y negativo."""
    wy = -side * WALL_Y
    tube_y = wy - side * 0.115     # tubo pegado a la cara exterior del poste
    cu = bpy.data.curves.new("pole_curve", 'CURVE')
    cu.dimensions = '3D'
    cu.bevel_depth = 0.05
    cu.bevel_resolution = 6
    cu.fill_mode = 'FULL'
    sp = cu.splines.new('BEZIER')
    sp.bezier_points.add(3)
    pts = [(0, 0, 0), (0, 0, 2.55), (0, side * 0.55, 3.35),
           (0, side * 1.55, HEAD_Z - ARM_RISE - 0.02)]
    for bp, co in zip(sp.bezier_points, pts):
        bp.co = co
        bp.handle_left_type = bp.handle_right_type = 'AUTO'
    ob = bpy.data.objects.new("light_pole", cu)
    ob.location = (x, tube_y, ARM_RISE)
    C.collection.objects.link(ob)
    cu.materials.append(M_STEEL)
    # abrazaderas al poste estructural
    for zb in (ARM_RISE + 0.12, ARM_RISE + 0.62):
        box("pole_clamp", x, wy - side * 0.055, zb, 0.13, 0.13, 0.07, M_STEEL)
    # tapa inferior del tubo
    cyl("pole_end", 0.052, 0.02, (x, tube_y, ARM_RISE - 0.01), (0, 0, 0),
        M_ORANGE, verts=16)
    # cabezal LED sobre la cancha
    head_y = tube_y + side * 1.78
    hb = box("led_head", x, head_y, HEAD_Z, 1.15, 0.30, 0.095, M_STEEL)
    bev = hb.modifiers.new("bev", 'BEVEL')
    bev.width = 0.028
    bev.segments = 3
    box("led_strip", x, head_y, HEAD_Z - 0.049, 0.98, 0.21, 0.006, M_LED)
    # detalle naranja en extremos del cabezal
    for s in (-1, 1):
        box("led_tip", x + s * 0.585, head_y, HEAD_Z, 0.02, 0.30, 0.095,
            M_ORANGE)
    return head_y


HEADS = []
for px in POLE_X:
    HEADS.append((px, light_pole(px, 1)))    # muro y negativo
    HEADS.append((px, light_pole(px, -1)))   # muro y positivo

# luces reales bajo cada cabezal (aporte fisico en escena nocturna)
if NIGHT:
    for (px, hy) in HEADS:
        bpy.ops.object.light_add(type='AREA', location=(px, hy, HEAD_Z - 0.06))
        lt = C.active_object
        lt.data.size = 1.0
        lt.data.size_y = 0.22
        lt.data.energy = 1400
        lt.data.color = (1.0, 0.96, 0.9)
        lt.rotation_euler = (0, 0, 0)

# ----------------------------------------------------------------------------
# Iluminacion de estudio y mundo
# ----------------------------------------------------------------------------
world = bpy.data.worlds.new("world")
scene.world = world
world.use_nodes = True
wnt = world.node_tree
bg = wnt.nodes["Background"]
if NIGHT:
    bg.inputs["Color"].default_value = (0.012, 0.015, 0.022, 1)
    bg.inputs["Strength"].default_value = 0.6
else:
    # gradiente vertical: horizonte gris claro -> cenit blanco (reflejos en vidrio)
    tc = wnt.nodes.new("ShaderNodeTexCoord")
    sep = wnt.nodes.new("ShaderNodeSeparateXYZ")
    ramp = wnt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = 0.0
    ramp.color_ramp.elements[0].color = (0.62, 0.63, 0.66, 1)
    ramp.color_ramp.elements[1].position = 0.6
    ramp.color_ramp.elements[1].color = (1.0, 1.0, 1.0, 1)
    wnt.links.new(tc.outputs["Generated"], sep.inputs["Vector"])
    wnt.links.new(sep.outputs["Z"], ramp.inputs["Fac"])
    wnt.links.new(ramp.outputs["Color"], bg.inputs["Color"])
    bg.inputs["Strength"].default_value = 0.7

if not NIGHT:
    bpy.ops.object.light_add(type='SUN', location=(0, 0, 30))
    sun = C.active_object
    sun.data.energy = 3.6
    sun.data.angle = math.radians(8)
    sun.data.color = (1.0, 0.985, 0.96)
    sun.rotation_euler = (math.radians(38), 0, math.radians(-52))

    bpy.ops.object.light_add(type='AREA', location=(0, 0, 24))
    top = C.active_object
    top.data.shape = 'RECTANGLE'
    top.data.size = 30
    top.data.size_y = 18
    top.data.energy = 2100
    top.data.color = (1.0, 1.0, 1.0)

    bpy.ops.object.light_add(type='AREA', location=(-26, -12, 12))
    fill = C.active_object
    fill.data.size = 16
    fill.data.energy = 600
    fill.rotation_euler = (math.radians(65), 0, math.radians(-65))
else:
    bpy.ops.object.light_add(type='AREA', location=(0, 0, 26))
    top = C.active_object
    top.data.size = 24
    top.data.energy = 220
    top.data.color = (0.6, 0.7, 1.0)

# ----------------------------------------------------------------------------
# Camara
# ----------------------------------------------------------------------------
cam_data = bpy.data.cameras.new("cam")
cam = bpy.data.objects.new("cam", cam_data)
C.collection.objects.link(cam)
scene.camera = cam

target = bpy.data.objects.new("target", None)
C.collection.objects.link(target)

if CAM == "hero":
    cam.location = (15.6, -20.5, 11.9)
    target.location = (0.35, 0.35, 0.7)
    cam_data.lens = 40
elif CAM == "low":
    cam.location = (16.5, -13.5, 2.1)
    target.location = (-1.0, 0.5, 1.5)
    cam_data.lens = 40
elif CAM == "net":
    cam.location = (6.0, -9.5, 2.4)
    target.location = (-0.8, -1.5, 1.1)
    cam_data.lens = 45

tc = cam.constraints.new('TRACK_TO')
tc.target = target
tc.track_axis = 'TRACK_NEGATIVE_Z'
tc.up_axis = 'UP_Y'

# ----------------------------------------------------------------------------
# Render
# ----------------------------------------------------------------------------
scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = SAMPLES
scene.cycles.use_adaptive_sampling = True
scene.cycles.adaptive_threshold = 0.02
scene.cycles.use_denoising = True
try:
    scene.cycles.denoiser = 'OPENIMAGEDENOISE'
except Exception:
    pass
scene.cycles.max_bounces = 10
scene.cycles.transmission_bounces = 10
scene.cycles.transparent_max_bounces = 24
scene.cycles.glossy_bounces = 5
scene.cycles.sample_clamp_indirect = 8.0
scene.cycles.caustics_reflective = False
scene.cycles.caustics_refractive = False

scene.render.resolution_x = RES_X
scene.render.resolution_y = RES_Y
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.filepath = OUTPATH

scene.view_settings.exposure = 0.35
try:
    scene.view_settings.view_transform = 'Filmic'
    scene.view_settings.look = 'Medium High Contrast'
except Exception:
    pass

bpy.ops.render.render(write_still=True)
print(f"RENDER OK -> {OUTPATH}")
