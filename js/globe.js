// for missions/wars https://globe.gl/example/random-rings/
// https://github.com/vasturiano/globe.gl/blob/master/example/random-rings/index.html

import { TextureLoader, ShaderMaterial, Vector2, SphereGeometry, MathUtils, MeshPhongMaterial, Mesh  } from 'https://esm.sh/three';
import * as solar from 'https://esm.sh/solar-calculator';
import { scaleSequentialSqrt } from 'https://esm.sh/d3-scale';
import { interpolateYlOrRd } from 'https://esm.sh/d3-scale-chromatic';
import * as turf from 'https://cdn.skypack.dev/@turf/turf';

export async function initGlobe() {
  const VELOCITY = 1; // minutes per frame

  // Custom shader:  Blends night and day images to simulate day/night cycle
  const dayNightShader = {
    vertexShader: `
      varying vec3 vNormal;
      varying vec2 vUv;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      #define PI 3.141592653589793
      uniform sampler2D dayTexture;
      uniform sampler2D nightTexture;
      uniform vec2 sunPosition;
      uniform vec2 globeRotation;
      varying vec3 vNormal;
      varying vec2 vUv;

      float toRad(in float a) {
        return a * PI / 180.0;
      }

      vec3 Polar2Cartesian(in vec2 c) { // [lng, lat]
        float theta = toRad(90.0 - c.x);
        float phi = toRad(90.0 - c.y);
        return vec3( // x,y,z
          sin(phi) * cos(theta),
          cos(phi),
          sin(phi) * sin(theta)
        );
      }

      void main() {
        float invLon = toRad(globeRotation.x);
        float invLat = -toRad(globeRotation.y);
        mat3 rotX = mat3(
          1, 0, 0,
          0, cos(invLat), -sin(invLat),
          0, sin(invLat), cos(invLat)
        );
        mat3 rotY = mat3(
          cos(invLon), 0, sin(invLon),
          0, 1, 0,
          -sin(invLon), 0, cos(invLon)
        );
        vec3 rotatedSunDirection = rotX * rotY * Polar2Cartesian(sunPosition);
        float intensity = dot(normalize(vNormal), normalize(rotatedSunDirection));
        vec4 dayColor = texture2D(dayTexture, vUv);
        vec4 nightColor = texture2D(nightTexture, vUv);
        float blendFactor = smoothstep(-0.1, 0.1, intensity);
        gl_FragColor = mix(nightColor, dayColor, blendFactor);
      }
    `
  };

  const sunPosAt = dt => {
    const day = new Date(+dt).setUTCHours(0, 0, 0, 0);
    const t = solar.century(dt);
    const longitude = (day - dt) / 864e5 * 360 - 180;
    return [longitude - solar.equationOfTime(t) / 4, solar.declination(t)];
  };

  let dt = +new Date();
  const colorScale = scaleSequentialSqrt(interpolateYlOrRd);
  const getVal = feat => feat.properties.GDP_MD_EST / Math.max(1e5, feat.properties.POP_EST);
  window.container = document.getElementById('globeViz');
  window.world = new Globe(container)
    .globeImageUrl('assets/images/equirectangular_earth_day_BM.jpg')
    //.backgroundImageUrl('//cdn.jsdelivr.net/npm/three-globe/example/img/night-sky.png')
    .polygonSideColor(() => 'rgba(80, 80, 80, 0.3)')
    .polygonStrokeColor(() => '#333')
    .lineHoverPrecision(0)
    .polygonsTransitionDuration(300)
    .onPolygonClick(clicked => {
      //const [lng, lat] = clicked.properties.centroid || [0, 0];
      //world.pointOfView({ lat, lng, altitude: 1.2 }, 1000);
    });

const capitalColors = {}; // Will be populated dynamically

// First, fetch faction data from your FastAPI backend
fetch(`${window.apiBase}/map`)
  .then(res => res.json())
  .then(factionData => {
    // Populate capitalColors mapping by ISO code
    factionData.forEach(entry => {
      capitalColors[entry.iso] = {
        faction: entry.faction,
        color: window.factions[entry.faction].color || 'rgba(150, 150, 150, 0.6)' // fallback color
      };
    });
    return fetch('/datasets/ne_110m_admin_0_countries.geojson');
  })
  .then(res => res.json())
  .then(data => {
    function hexToRgba(hex, alpha) {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    const features = data.features;
    const baseAltitude = 0.001;
    const boostedAltitude = 0.01;
    const hoverAltitude = 0.02;

    world
      .polygonsData(features)
      .polygonCapColor(d => {
        const iso = d.properties.ISO_A3;
        const entry = capitalColors[iso];
        return entry ? hexToRgba(entry.color, 0.5) : 'rgba(150, 150, 150, 0.2)';
      })
      .polygonSideColor(() => 'rgba(80, 80, 80, 0.2)')
      .polygonStrokeColor(() => 'transparent') //'#333')
      .polygonAltitude(feat => {
        const iso = feat.properties.ISO_A3;
        return capitalColors[iso] ? boostedAltitude : baseAltitude;
      })
      .polygonLabel(d => {
        const iso = d.properties.ISO_A3;
        return capitalColors[iso]
          ? `<b><center>${d.properties.NAME}</center>Owned by: ${capitalColors[iso].faction}</b>`
          : `<b>${d.properties.NAME}</b>`;
      })
      .onPolygonHover(hoverD =>
        world
          .polygonAltitude(d => {
            const iso = d.properties.ISO_A3;
            if (d === hoverD) {
              return hoverAltitude;
            }
            return capitalColors[iso] ? boostedAltitude : baseAltitude;
          })
          .polygonCapColor(d => {
            const iso = d.properties.ISO_A3;
            const entry = capitalColors[iso];
            if (d === hoverD) {
              return entry
                ? hexToRgba(entry.color, 0.7) // solid color on hover
                : 'rgba(0, 0, 0, 0.6)';
            }
            return entry
              ? hexToRgba(entry.color, 0.3)
              : 'rgba(150, 150, 150, 0.2)';
          })
      )
      .onPolygonClick(clicked => {
        const centroid = turf.centroid(clicked);
        const [lng, lat] = centroid.geometry.coordinates;
        world.pointOfView({ lat, lng, altitude: 1.2 }, 1000);
      });
    // Focus on faction trigger
    let elem = document.getElementById("game-map")
    let animationStarted = false;
    const observer = new IntersectionObserver(
      (entries) => {
        const globeEntry = entries[0];
        if (globeEntry.isIntersecting && !animationStarted) {
          animationStarted = true;
          focusOnFaction(world, data); // make sure `world` is in scope here
        }
      },
      {
        root: null, // viewport
        threshold: 0.6 // 60% of the globe section must be visible
      }
    );
    if (elem) observer.observe(elem);
  });

  // Load sphere textures
  Promise.all([
    new TextureLoader().loadAsync('assets/images/equirectangular_earth_day_BM.jpg'),
    new TextureLoader().loadAsync('assets/images/equirectangular_earth_night.jpg')
  ]).then(([dayTexture, nightTexture]) => {
    const material = new ShaderMaterial({
      uniforms: {
        dayTexture: { value: dayTexture },
        nightTexture: { value: nightTexture },
        sunPosition: { value: new Vector2() },
        globeRotation: { value: new Vector2() }
      },
      vertexShader: dayNightShader.vertexShader,
      fragmentShader: dayNightShader.fragmentShader
    });

    // Load galaxy textures
    world.globeMaterial(material)
    //.backgroundImageUrl('//cdn.jsdelivr.net/npm/three-globe/example/img/night-sky.png')
    .backgroundImageUrl('assets/images/milky_way.png')
    // Update globe rotation on shader
    .onZoom(({ lng, lat }) => material.uniforms.globeRotation.value.set(lng, lat));

    // Loads clouds sphere texture
    const CLOUDS_IMG_URL = 'assets/images/equirectangular_earth_clouds.png';
    const CLOUDS_ALT = 0.005;
    const CLOUDS_ROTATION_SPEED = -0.006; // deg/frame

    let cloudMaterial; // make this accessible globally
    let clouds;        // the mesh itself

    new TextureLoader().load(CLOUDS_IMG_URL, cloudsTexture => {
      cloudMaterial = new MeshPhongMaterial({
        map: cloudsTexture,
        transparent: true,
        opacity: 0.75
      });

      clouds = new Mesh(
        new SphereGeometry(world.getGlobeRadius() * (1 + CLOUDS_ALT), 75, 75),
        cloudMaterial
      );

      world.scene().add(clouds);
      (function rotateClouds() {
        clouds.rotation.y += CLOUDS_ROTATION_SPEED * Math.PI / 180;
        requestAnimationFrame(rotateClouds);
      })();

    // Day/night animation
    requestAnimationFrame(() =>
      (function animate() {
        // animate time of day
        const now = Date.now();
        material.uniforms.sunPosition.value.set(...sunPosAt(now));
        requestAnimationFrame(animate);
      })()
    );
    });
  });
  return world;
}

export function focusOnFaction(world, geoJsonData) {
  // Find the country feature by ISO
  const countryFeature = geoJsonData.features.find(
    feat => feat.properties.ISO_A3 === window.user.player.location
  );

  if (!countryFeature) {
    console.warn('No feature found in GeoJSON for ISO:', isoCode);
    return;
  }

  // Get the centroid using Turf.js
  const centroid = turf.centroid(countryFeature);
  const [lng, lat] = centroid.geometry.coordinates;
  const targetAltitude = 1.2;

  // Animate rotation (optional)
  const controls = world.controls();
  let angle = 0;
  const rotationSpeed = 1;
  let focusReached = false;

  function animateRotation() {
    if (!focusReached) {
      angle += rotationSpeed;
      controls.azimuthAngle = angle;
      world.controls().update();

      if (angle > Math.PI / 2) {
        focusReached = true;
        world.pointOfView({ lat, lng, altitude: targetAltitude }, 4000);
      } else {
        requestAnimationFrame(animateRotation);
      }
    }
  }

  animateRotation();
}

// Optionally ensure the globe resizes with the container:
export function resizeCanvas() {
  const { clientWidth, clientHeight } = container;
  world.width(clientWidth).height(clientHeight);
}