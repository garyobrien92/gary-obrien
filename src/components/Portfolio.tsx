import { useEffect, useRef } from "react";
import * as THREE from 'three'
import { TextGeometry } from 'three/examples/jsm/Addons.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js'

export default function Portfolio() {
  const refContainer = useRef(null);

  useEffect(() => {
    /**
* Textures
*/

    if (!refContainer.current) return;

    const textureLoader = new THREE.TextureLoader()
    const texture = textureLoader.load('textures/matcaps/5.png')

    /**
     * Base
     */
    // Canvas
    const canvas = refContainer.current;

    // Scene
    const scene = new THREE.Scene()

    /**
     * Object
     * 
     */
    const geometry = new THREE.BoxGeometry(1, 1, 1)
    const material = new THREE.MeshBasicMaterial({ map: texture })
    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.y = 1.3
    const fontLoader = new FontLoader()

    fontLoader.load(
      '/fonts/helvetiker_regular.typeface.json',
      (font) => {
        // Text
        const inProgressTextGeometry = new TextGeometry(
          'In Progress',
          {
            font: font,
            size: 0.5,
            height: 0.2,
            curveSegments: 12,
            bevelEnabled: true,
            bevelThickness: 0.03,
            bevelSize: 0.02,
            bevelOffset: 0,
            bevelSegments: 5
          }
        )
        inProgressTextGeometry.center()

        const projectsText = new THREE.Mesh(inProgressTextGeometry, material)
        scene.add(projectsText)
      }
    )
    scene.add(mesh)

    /**
     * Sizes
     */
    const sizes = {
      width: window.innerWidth,
      height: window.innerHeight
    }

    window.addEventListener('resize', () => {
      // Update sizes
      sizes.width = window.innerWidth
      sizes.height = window.innerHeight

      // Update camera
      camera.aspect = sizes.width / sizes.height
      camera.updateProjectionMatrix()

      // Update renderer
      renderer.setSize(sizes.width, sizes.height)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    })

    /**
     * Camera
     */
    // Base camera
    const camera = new THREE.PerspectiveCamera(75, sizes.width / sizes.height, 0.1, 100)
    camera.position.x = 0
    camera.position.y = 1.5
    camera.position.z = 3
    scene.add(camera)

    // Controls
    const controls = new OrbitControls(camera, canvas)
    controls.enableDamping = true

    /**
     * Renderer
     */
    const renderer = new THREE.WebGLRenderer({
      canvas: canvas
    })
    renderer.setSize(sizes.width, sizes.height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

    /**
     * Animate
     */
    const clock = new THREE.Clock()

    const tick = () => {
      const elapsedTime = clock.getElapsedTime()

      // Update controls
      controls.update()

      mesh.rotation.y += 0.001;
      mesh.rotation.x += 0.002;

      // Render
      renderer.render(scene, camera)

      // Call tick again on the next frame
      window.requestAnimationFrame(tick)
    }

    tick()
  }, [])

  return (
    <canvas ref={refContainer} className="webgl"></canvas>
  )
}
