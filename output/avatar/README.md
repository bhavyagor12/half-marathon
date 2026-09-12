# Bhavya 360° avatar — model handoff

Status: **Meshy GLB generated and integrated into the local website; production build, focused lint, and all 14 tests passed. Publishing is pending explicit user approval after automatic review rejected the production-triggering push.** User explicitly requires full 360° rotation and very accurate likeness. A flat portrait, billboard, or generic procedural character does not satisfy this requirement.

`bhavya-modeling-reference.png` is a generated frontal race-kit reference using the five user-supplied photographs and the built-in image-generation tool. It is a 1024 × 1536 RGB image with a baked checkerboard, not transparent alpha and not a mesh. Facial likeness has not been approved by Bhavya. The original photos remain the identity authority; the generated physique and clothing are approximations.

## Required model

- Deliver a textured GLB with genuine geometry visible from every angle, including face, hair, clear glasses, ears, hands, and shoes.
- Match Bhavya's original photographs, especially the close-up for facial details. Do not exaggerate musculature or beautify proportions. Side/back anatomy is not fully documented by the supplied photos.
- Race kit: off-white short-sleeved crewneck tee, charcoal running shorts, white/gray running shoes; watch on left wrist, thread bracelets on right, thin silver chain.
- Neutral standing pose, hands slightly separated from torso, feet hip-width apart. Y-up, front +Z, feet on ground; center at X=Z=0.
- Separate named shirt/shorts surfaces and attachable sponsor anchors, or provide UV regions suitable for nine placements. No baked sponsor logos.
- Review frontal, both profile, three-quarter, and rear views before accepting likeness. Check eyewear, fingers, hair silhouette, garment intersections, and face texture under neutral light.

## Repo integration

`app/Arena.tsx` currently creates a procedural runner inside a Three.js Group at Y=0.23. Existing patches are separate planes at hard-coded coordinates, not conforming decals. A replacement GLB requires scale/ground alignment and sponsor placement recalibration to its actual shirt/shorts geometry; simply swapping the head is insufficient.

Preserve OrbitControls, front/back buttons, selected-slot highlighting, sponsor textures, raycasting, mobile layout, WebGL fallback, resource disposal, and scene lighting. Prevent clicks through the body when resolving sponsor hits. Validate front/back placement and full orbit with the actual mesh before publishing.

## Reference inspection, 2026-09-12

The public [HYROX reference site](https://hyrox.marclou.com/) loads `/models/marc-20260909-glutes-v1.glb` with `/draco/` and resolves named surface anchors from its cloned scene. This was verified in its publicly served JavaScript. Its mesh was not downloaded or reused. Browser runtime setup failed, so no visual browser testing was performed.

[Meshy multi-image-to-3D](https://docs.meshy.ai/en/api/multi-image-to-3d) is a possible external reconstruction route with GLB output. Meshy 7 Ultra was subsequently connected and called with the generated frontal race-kit reference; job `01a095d4-9609-767e-b540-e29bc00c747f` succeeded for 35 credits. Generation is an initial reconstruction, not a guarantee of identity accuracy; final likeness needs review and potentially manual sculpting. A consistent set of front/side/back photos or a scan would supply missing geometry more reliably than these mixed-pose photographs.

## Generation brief used

Identity-preserving full-body realistic 3D-style frontal render using all five photos, close-up as facial authority and pink-shirt image for physique/hair. Preserve facial proportions, smile, stubble, black swept hair and clear glasses; lean normal physique. Plain off-white athletic tee, charcoal shorts, white/gray sneakers, short socks, silver chain/watch and thread bracelets. Neutral relaxed A pose, complete figure within frame, chest-height near-orthographic camera, neutral studio illumination, no text/logos/platform/scenery. Transparent background was requested but not delivered; do not treat the checkerboard as alpha.


## Completed reconstruction — 2026-09-12

- `bhavya.glb`: original Meshy textured, remeshed GLB (29,822,336 bytes).
- `bhavya-high-detail.glb`: pre-remesh master (55,133,340 bytes).
- `preview-front.png`, `preview-right.png`, `preview-back.png`, `preview-left.png`: provider-rendered model views, visually inspected. Body has real depth; glasses, hair, watch, bracelets, shirt and shorts are present. Face remains an approximation, especially side/back views that were not supplied as consistent photographic references.
- `../../public/models/bhavya.glb`: web-optimized embedded-texture model (10,718,824 bytes), unchanged geometry, 102,339 triangles, 4096² base-color map and 2048² normal/metallic-roughness maps.
- `meshy-task.json`: non-secret generation parameters, input hash and resumable task ID. No credentials or signed asset URLs are stored.
- The application now loads the GLB, normalizes it to 3.9 scene units, and uses `DecalGeometry` to fit sponsor graphics to the model. All nine anchor rays hit the expected shirt/shorts texture region. Generic mannequin geometry was removed.
