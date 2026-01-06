#version 300 es
precision highp float;
precision highp int;

struct Camera {
    vec3 pos;
    vec3 forward;
    vec3 right;
    vec3 up;
};

struct Plane {
    vec3 point;
    vec3 normal;
    vec3 color;
};

struct Sphere {
    vec3 center;
    float radius;
    vec3 color;
    int type; // 0: opaque, 1: reflective, 2: refractive
};

struct Light {
    vec3 position;
    vec3 direction;
    vec3 color;
    float shininess;
    float cutoff; // if > 0.0 then spotlight else directional light
};

struct HitInfo {
    vec3 rayOrigin;
    vec3 rayDir;
    float t;
    vec3 baseColor;
    int inside; // 1 if inside the sphere, 0 otherwise
    vec3 hitPoint;
    vec3 normal;
    int type; // 0: diffuse, 1: reflective
};

const int TYPE_DIFFUSE = 0;
const int TYPE_REFLECTIVE = 1;
const int TYPE_REFRACTIVE = 2;

const int MAX_SPHERES = 16;
const int MAX_LIGHTS = 4;
const int MAX_DEPTH = 5;

in vec2 vUV;
out vec4 FragColor;

uniform float uTime;
uniform ivec2 uResolution; // width and height of canvas


uniform Camera cam;
uniform Sphere uSpheres[MAX_SPHERES];
uniform int uNumSpheres;

uniform Light uLights[MAX_LIGHTS];
uniform int uNumLights;

uniform Plane uPlane;

vec3 checkerboardColor(vec3 rgbColor, vec3 hitPoint) {
    // Checkerboard pattern
    float scaleParameter = 2.0;
    float checkerboard = 0.0;
    if (hitPoint.x < 0.0) {
    checkerboard += floor((0.5 - hitPoint.x) / scaleParameter);
    }
    else {
    checkerboard += floor(hitPoint.x / scaleParameter);
    }
    if (hitPoint.z < 0.0) {
    checkerboard += floor((0.5 - hitPoint.z) / scaleParameter);
    }
    else {
    checkerboard += floor(hitPoint.z / scaleParameter);
    }
    checkerboard = (checkerboard * 0.5) - float(int(checkerboard * 0.5));
    checkerboard *= 2.0;
    if (checkerboard > 0.5) {
    return 0.5 * rgbColor;
    }
    return rgbColor;
}

/* intersects scene. gets ray origin and direction, returns hit data*/
/*should be hit data type*/ HitInfo intersectScene(vec3 rayOrigin, vec3 rayDir) {
    HitInfo info;
    info.t = 10000.0; // Initialize with a far distance
    info.type = -1;   // -1 indicates no hit
    info.rayDir = rayDir;
    
    // 1. Intersect Plane
    float denom = dot(uPlane.normal, rayDir);
    // Check if ray is not parallel to plane
    if (abs(denom) > 0.0001) {
        float t = dot(uPlane.point - rayOrigin, uPlane.normal) / denom;
        if (t > 0.001 && t < info.t) {
            info.t = t;
            info.hitPoint = rayOrigin + rayDir * t;
            info.normal = uPlane.normal;
            info.baseColor = checkerboardColor(uPlane.color, info.hitPoint);
            info.type = TYPE_DIFFUSE;
        }
    }

    // 2. Intersect Spheres
    for (int i = 0; i < MAX_SPHERES; i++) {
        if (i >= uNumSpheres) break;
        
        Sphere s = uSpheres[i];
        vec3 oc = rayOrigin - s.center;
        float b = dot(oc, rayDir);
        float c = dot(oc, oc) - s.radius * s.radius;
        float h = b * b - c;

        if (h >= 0.0) {
            float t = -b - sqrt(h);
            if (t > 0.001 && t < info.t) {
                info.t = t;
                info.hitPoint = rayOrigin + rayDir * t;
                info.normal = normalize(info.hitPoint - s.center);
                info.baseColor = s.color;
                info.type = s.type;
            }
        }
    }

    return info;
}
/* calculates color based on hit data and uv coordinates */
vec3 calcColor(/*hit data type*/ HitInfo hitInfo) {
    if (hitInfo.type == -1) {
        return vec3(0.0); // Background color
    }

    vec3 finalColor = vec3(0.0);
    vec3 ambient = vec3(0.1);
    Light light;
    // Simple Diffuse Lighting (Lambertian)
    for (int i = 0; i < MAX_LIGHTS; i++) {
        if (i >= uNumLights) break;
        
        light = uLights[i];

        vec3 lightDir = normalize(light.position - hitInfo.hitPoint);
        
        // Calculate diffuse intensity
        float diff = max(dot(hitInfo.normal, lightDir), 0.0);

        // Calculate specular intensity
        vec3 reflected = reflect(-lightDir, hitInfo.normal);
        float specAngle = max(dot(reflected, -hitInfo.rayDir), 0.0);
        float spec = pow(specAngle, light.shininess);
        
        finalColor += hitInfo.baseColor * light.color * (diff + spec);
    }
    return finalColor + hitInfo.baseColor * ambient;
}

/* scales UV coordinates based on resolution
 * uv given uv are [0, 1] range
 * returns new coordinates where y range [-1, 1] and x scales according to window resolution
 */
vec2 scaleUV(vec2 uv) {
    // Convert 0..1 to -1..1
    vec2 ndc = uv * 2.0 - 1.0;
    // Correct aspect ratio
    float aspect = float(uResolution.x) / float(uResolution.y);
    ndc.x *= aspect;
    return ndc;
}

void main() {

    vec2 uv = scaleUV(vUV);
    vec3 rayDir = normalize(cam.forward + uv.x * cam.right + uv.y * cam.up);

    HitInfo hitInfo = intersectScene(cam.pos, rayDir);

    vec3 color = calcColor(hitInfo);
    FragColor = vec4(color, 1.0);
}
