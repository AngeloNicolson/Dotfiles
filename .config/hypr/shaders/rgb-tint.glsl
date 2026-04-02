#version 300 es
precision highp float;

in vec2 v_texcoord;
uniform sampler2D tex;
out vec4 fragColor;

const vec3 RGB_TINT = vec3(1.000, 0.900, 0.800);
const float WHITE_CAP = 0.700;

void main() {
    vec4 c = texture(tex, v_texcoord);
    c.rgb *= RGB_TINT;
    c.rgb = min(c.rgb, vec3(WHITE_CAP));
    fragColor = c;
}
