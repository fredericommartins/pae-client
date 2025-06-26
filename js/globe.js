// for missions/wars https://globe.gl/example/random-rings/
// https://github.com/vasturiano/globe.gl/blob/master/example/random-rings/index.html

import { DoubleSide, TextureLoader, ShaderMaterial, Vector2, SphereGeometry, MathUtils, MeshPhongMaterial, Mesh, MeshBasicMaterial } from 'https://esm.sh/three';
import * as solar from 'https://esm.sh/solar-calculator';
import { scaleSequentialSqrt } from 'https://esm.sh/d3-scale';
import { interpolateYlOrRd } from 'https://esm.sh/d3-scale-chromatic';
import * as turf from 'https://cdn.skypack.dev/@turf/turf';

let factionAltitude = 1.0;

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
    .lineHoverPrecision(0)
    .polygonsTransitionDuration(300)

// First, fetch faction data from your FastAPI backend
fetch(`${window.apiBase}/map`, {
    headers: {
      Authorization: `Bearer ${localStorage.getItem('token')}`
    }
  })
  .then(res => res.json())
  .then(factionData => {
    return fetch('/datasets/custom_countries_lr-geojsonmapskyd.geojson')
      .then(res => res.json())
      .then(data => {
        // Merge faction data into GeoJSON features
        data.features.forEach(feature => {
          const iso = feature.properties.adm0_a3;
          const match = factionData.find(f => f.iso === iso);
          if (match) {
            const factionName = match.faction?.name || null;
            feature.properties.faction = factionName;
            feature.properties.policies = [...match.policies, ...match.faction?.key_policies || []];
            feature.properties.factionColor = window.factions[factionName]?.color || '#969696';
          }
        });

        function hexToRgba(hex, alpha) {
          const r = parseInt(hex.slice(1, 3), 16);
          const g = parseInt(hex.slice(3, 5), 16);
          const b = parseInt(hex.slice(5, 7), 16);
          return `rgba(${r}, ${g}, ${b}, ${alpha})`;
        }

        const allowedCountries = new Set(factionData.map(c => c.iso));
        const baseAltitude = 0.001;
        const boostedAltitude = 0.015;
        const hoverAltitude = 0.02;
        let prevPolygon = null;

        world
          .polygonsData(data.features)
          .polygonCapColor(d => {
            const color = d.properties.factionColor;
            return color ? hexToRgba(color, 0.5) : 'rgba(150, 150, 150, 0.2)';
          })
          .polygonSideColor(() => 'rgba(80, 80, 80, 0.2)')
          .polygonStrokeColor(d => {
                const color = d.properties.factionColor;
                return color
                  ? hexToRgba(color, 0.3)
                  : 'rgba(150, 150, 150, 0.2)';
              })
          .polygonAltitude(d => d.properties.faction ? boostedAltitude : baseAltitude)
          .polygonLabel(d =>
            d.properties.faction
              ? `<b><center>${d.properties.name}</center>Owned by: ${d.properties.faction}</b>`
              : `<b>${d.properties.name}</b>`
          )
          .onPolygonClick(clicked => {
            const iso = clicked.properties.adm0_a3;
            if (allowedCountries.has(iso)) {
              const centroid = turf.centroid(clicked);
              const [lng, lat] = centroid.geometry.coordinates;
              world.pointOfView({ lat, lng, altitude: factionAltitude }, 1000);
              const owner = clicked.properties.faction;
              showCountryLandUI(owner, clicked.properties.name, clicked);
            }
          })
          .onPolygonHover(polygon => {
            // Clear all custom materials first
            world.polygonsData().forEach(p => delete p.__customMaterial);

            const isHovering = !!polygon;
            const iso = polygon?.properties?.adm0_a3;
            const iso2 = polygon?.properties?.iso_a2?.toLowerCase();
            const hasNoFaction = polygon?.properties?.faction === 'None';
            const factionColor = polygon?.properties?.factionColor;

            // Handle hover with valid target (gets nation flags for neighbours)
            // if (isHovering && allowedCountries.has(iso) && hasNoFaction) {
            //   const flagUrl = `https://flagcdn.com/${iso2}.svg`;
            //   new TextureLoader().load(flagUrl, texture => {
            //     polygon.__customMaterial = new MeshBasicMaterial({
            //       map: texture,
            //       transparent: true,
            //       opacity: 0.55,
            //       depthTest: false,
            //       side: DoubleSide
            //     });
            //     world.polygonCapMaterial(p =>
            //       p.__customMaterial || defaultMaterial(p.properties.factionColor)
            //     );
            //   });
            // }

            // Update previous polygon tracker
            prevPolygon = isHovering ? polygon : null;

            // Altitude logic
            world
              .polygonAltitude(d =>
                d === polygon
                  ? hoverAltitude
                  : d.properties.faction
                    ? boostedAltitude
                    : baseAltitude
              )

              // Cap color logic
              .polygonCapColor(d => {
                const color = d.properties.factionColor;
                if (d === polygon) {
                  return color || 'rgb(0, 0, 0)'; // fallback black for hover
                }
                return color || 'rgb(150, 150, 150)'; // fallback gray
              })

              // Set cap material with correct opacity
              .polygonCapMaterial(d => {
                const iso = d.properties.adm0_a3;
                const hasNoFaction = d.properties.faction === 'None';
                const color = d.properties.factionColor || '#969696'; // fallback gray
                if (d === polygon && allowedCountries.has(iso)) {
                  return new MeshBasicMaterial({
                    color: color || 'rgb(0, 0, 0)',
                    transparent: true,
                    opacity: color ? 0.75 : 1,
                    depthTest: true,
                    side: DoubleSide
                  });
                }
                return d.__customMaterial || defaultMaterial(d.properties.factionColor)
              });
          });

          function defaultMaterial(color) {
            return new MeshBasicMaterial({
              color: color || 'rgb(0, 0, 0)',
              transparent: true,
              opacity: color ? 0.5 : 0.6,
              depthTest: true,
              side: DoubleSide
            });
          }

        // Focus on faction when globe is visible
        const elem = document.getElementById("game-map");
        let animationStarted = false;
        const observer = new IntersectionObserver(entries => {
          const globeEntry = entries[0];
          if (globeEntry.isIntersecting && !animationStarted) {
            animationStarted = true;
            focusOnFaction(world, data); // world must be in scope
          }
        }, { threshold: 0.6 });

        if (elem) observer.observe(elem);
      });
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
    feat => feat.properties.adm0_a3 === window.user.player.location
  );

  // Get the centroid using Turf.js
  const centroid = turf.centroid(countryFeature);
  const [lng, lat] = centroid.geometry.coordinates;
  const targetAltitude = factionAltitude;

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
        world.pointOfView({ lat, lng, altitude: targetAltitude }, 3000);
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

function showCountryLandUI(owner, region, feature) {
  const color = window.factions[owner]?.color ?? "#999999";
  const elConsensus = document.getElementById("region-consensus");
  const elIcon = document.getElementById("faction-icon");
  const elFaction = document.getElementById('region-taxing-faction');
  elFaction.textContent = owner || 'no one';
  elFaction.style.color = color;
  document.getElementById('region-name').textContent = region;
  elIcon.textContent = window.factions[owner]?.symbol ?? "🌐";
  elIcon.style.color = color;
  if (owner) {
    elConsensus.textContent = "CONSENSUS";
    elConsensus.classList.add("bg-green-700");
    elConsensus.classList.remove("animate-pulse");
    document.getElementById('region-faction-name').textContent = owner;
  } else {
    elConsensus.textContent = "DISSENSUS";
    elConsensus.classList.remove("bg-green-700");
    elConsensus.classList.add("animate-pulse");
    document.getElementById('region-faction-name').textContent = "";

  }
  document.getElementById('region-faction-name').style.color = color;
  document.getElementById('landTileModal').classList.remove('hidden');

  // Hide unused policies
  document.querySelectorAll("#policies-container > *").forEach(elem => {
    const id = elem.id;
    const isInAllowed = feature.properties.policies.includes(id);
    if (isInAllowed) {
      elem.classList.remove("hidden");
    } else {
      elem.classList.add("hidden");
    }
  });

}