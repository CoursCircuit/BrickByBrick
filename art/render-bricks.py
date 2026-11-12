"""Render the word bricks and the stages of each score wall with Blender.

Run blender -b -t 8 -P art/render-bricks.py -- /path/to/frames.
Each pair of PNG wall frames represents one point. Pack frames 00–12 into
a four-column atlas, leaving the remaining three cells transparent.
"""

from pathlib import Path
import sys

import bpy
from mathutils import Vector


destination = Path(sys.argv[sys.argv.index("--") + 1])
destination.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = 12
scene.cycles.use_denoising = True
scene.render.resolution_percentage = 100
scene.render.film_transparent = True
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'
scene.view_settings.view_transform = 'AgX'
scene.view_settings.look = 'AgX - Medium High Contrast'
world = bpy.data.worlds.new("Studio")
world.use_nodes = True
world.node_tree.nodes["Background"].inputs["Color"].default_value = (.27, .38, .6, 1)
world.node_tree.nodes["Background"].inputs["Strength"].default_value = .32
scene.world = world


def linear(value):
    return ((value + .055) / 1.055) ** 2.4 if value > .04045 else value / 12.92


def color(hex_color, factor=1):
    return tuple(linear(int(hex_color[i:i+2], 16) / 255) * factor for i in (0, 2, 4)) + (1,)


def material(name, hex_color, roughness, textured=False):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    shader = nodes["Principled BSDF"]
    shader.inputs["Base Color"].default_value = color(hex_color)
    shader.inputs["Roughness"].default_value = roughness
    if textured:
        shader.inputs["Coat Weight"].default_value = .19
        shader.inputs["Coat Roughness"].default_value = .26
        grain = nodes.new("ShaderNodeTexNoise")
        grain.inputs["Scale"].default_value = 68
        grain.inputs["Detail"].default_value = 3.1
        ramp = nodes.new("ShaderNodeValToRGB")
        ramp.color_ramp.elements[0].position = .20
        ramp.color_ramp.elements[0].color = color(hex_color, .66)
        ramp.color_ramp.elements[1].position = .80
        ramp.color_ramp.elements[1].color = color(hex_color, 1.14)
        bump = nodes.new("ShaderNodeBump")
        bump.inputs["Strength"].default_value = .18
        bump.inputs["Distance"].default_value = .008
        links.new(grain.outputs["Fac"], ramp.inputs[0])
        links.new(grain.outputs["Fac"], bump.inputs["Height"])
        links.new(ramp.outputs[0], shader.inputs["Base Color"])
        links.new(bump.outputs[0], shader.inputs["Normal"])
    return mat


def finish_mesh(obj, name, mat, radius):
    obj.name = name
    obj.data.materials.append(mat)
    bevel = obj.modifiers.new("Rounded edges", "BEVEL")
    bevel.width = radius
    bevel.segments = 4
    bevel.harden_normals = True
    normal = obj.modifiers.new("Weighted normals", "WEIGHTED_NORMAL")
    normal.keep_sharp = True
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    return obj


def box(name, size, location, mat, radius=.042):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.object
    obj.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish_mesh(obj, name, mat, radius)


def brick(name, size, location, mat, stud_radius):
    width, depth, height = size
    x, y, z = location
    parts = [box(name, size, location, mat, radius=min(height * .12, .067))]
    for direction in (-1, 1):
        stud_height = stud_radius * .54
        bpy.ops.mesh.primitive_cylinder_add(
            vertices=36, radius=stud_radius, depth=stud_height,
            location=(x + direction * width * .32, y, z + height / 2 + stud_height * .40)
        )
        parts.append(finish_mesh(bpy.context.object, name + " / stud", mat, stud_height * .25))
    return parts


def aim(obj, location, target):
    obj.location = location
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat('-Z', 'Y').to_euler()


def area(name, location, target, power, light_color, size):
    data = bpy.data.lights.new(name, 'AREA')
    data.energy = power
    data.color = light_color
    data.shape = 'DISK'
    data.size = size
    obj = bpy.data.objects.new(name, data)
    scene.collection.objects.link(obj)
    aim(obj, location, target)


def render(name, resolution, location, target, scale):
    aim(camera, location, target)
    camera.data.ortho_scale = scale
    scene.render.resolution_x, scene.render.resolution_y = resolution
    scene.render.filepath = str(destination / (name + ".png"))
    bpy.ops.render.render(write_still=True)


def show(parts, visible):
    for part in parts:
        part.hide_render = not visible


camera = bpy.data.objects.new("Orthographic camera", bpy.data.cameras.new("Camera"))
camera.data.type = 'ORTHO'
scene.collection.objects.link(camera)
scene.camera = camera
area("Key", (-3.4, -4.6, 6.5), (0, 0, .8), 710, (.89, .95, 1), 4.5)
area("Fill", (3.8, -5.8, 3.9), (0, 0, .8), 440, (1, .88, .72), 5.3)
area("Edge", (0, 2.6, 5.1), (0, 0, .6), 860, (.81, .91, 1), 3.4)

steel = material("Graphite anodized aluminium", "2A3C51", .33)
team_materials = [
    ("jade", material("Jade glazed masonry", "53CC9A", .32, True), 1),
    ("ambre", material("Amber glazed masonry", "EF9043", .32, True), -1)
]

for team, ceramic, side in team_materials:
    word_brick = brick("Word", (4.52, .66, .94), (0, 0, .6), ceramic, .228)
    render("word-" + team, (760, 300), (0, -13, 3.35), (0, 0, .68), 4.78)
    show(word_brick, False)

    platform = box("Foundation", (6.54, 1.19, .16), (0, 0, .085), steel, .036)
    stack = []
    for course in range(6):
        for slot in (-.5, .5, -1.5, 1.5):
            x = (slot + (.31 * side if course % 2 else 0)) * 1.47
            z = .408 + course * .498
            unit = brick("Course %d" % (course + 1), (1.446, .83, .483), (x, 0, z), ceramic, .125)
            show(unit, False)
            stack.append(unit)
    for points in range(13):
        for unit in stack[max(0, (points - 1) * 2):points * 2]:
            show(unit, True)
        render(f"wall-{team}-{points:02}", (504, 266), (side * 1.65, -10.7, 3.8), (0, 0, 1.61), 7.15)

    show([platform], False)
    for unit in stack:
        show(unit, False)
