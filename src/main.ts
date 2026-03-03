import "./style.css";
import * as BUI from "@thatopen/ui";
import * as OBC from "@thatopen/components";
import * as OBF from "@thatopen/components-front";
import * as CUI from "@thatopen/ui-obc";
import * as WEBIFC from "web-ifc";
import * as THREE from "three";
import { TilesRenderer } from "3d-tiles-renderer";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

//1. That Open Engine

//1.1 Set up :

BUI.Manager.init();

const viewport = document.createElement("bim-viewport");

const components = new OBC.Components();

const worlds = components.get(OBC.Worlds);

const world = worlds.create();
const sceneComponent = new OBC.SimpleScene(components);
sceneComponent.setup();
world.scene = sceneComponent;

const rendererComponent = new OBC.SimpleRenderer(components, viewport);
world.renderer = rendererComponent;

const cameraComponent = new OBC.OrthoPerspectiveCamera(components);
world.camera = cameraComponent;
cameraComponent.controls.setLookAt(19, 1.4, 8, 19, 1.4, -10);

viewport.addEventListener("resize", () => {
  rendererComponent.resize();
  cameraComponent.updateAspect();
});

components.init();

const grids = components.get(OBC.Grids);
grids.create(world);

const fragments = components.get(OBC.FragmentsManager);
const fragmentIfcLoader = components.get(OBC.IfcLoader);

await fragmentIfcLoader.setup();

fragmentIfcLoader.settings.webIfc.COORDINATE_TO_ORIGIN = false;

//1.2 Load IFC as Fragments :

const file = await fetch(
  "https://raw.githubusercontent.com/rvouilloz/hbim-viewer-fontainebleau/main/resources/models/ifc/model.ifc",
);
const data = await file.arrayBuffer();
const buffer = new Uint8Array(data);
const model = await fragmentIfcLoader.load(buffer);
//world.scene.three.add(model); //rather set at checkbox level
let modelAdded = false;

//1.3 Make IFC transparent :

const classifier = components.get(OBC.Classifier);
classifier.byModel(model.uuid, model);
const modelItems = classifier.find({ models: [model.uuid] });
const hider = components.get(OBC.Hider);
//hider.set(false, modelItems); //rather set at checkbox level

//1.4 Classify IFC by Properts Sets :

await classifier.byIfcRel(model, WEBIFC.IFCRELDEFINESBYPROPERTIES, "pset");
const crackStones = classifier.find({
  pset: ["Stone deterioration: Crack & deformation"],
});
const crackMaterial = new THREE.MeshStandardMaterial({
  color: 0xe5a712,
  transparent: true,
  opacity: 0.5,
  depthTest: false,
});
const crackStonesKeys = Object.keys(crackStones);
fragments.meshes.forEach((mesh) => {
  if (crackStonesKeys.includes(mesh.uuid)) {
    mesh.material = crackMaterial;
  }
});
await classifier.byIfcRel(model, WEBIFC.IFCRELDEFINESBYPROPERTIES, "pset");
const detachmentStones = classifier.find({
  pset: ["Stone deterioration: Detachment"],
});
const detachmentMaterial = new THREE.MeshStandardMaterial({
  color: 0xcb572c,
  transparent: true,
  opacity: 0.5,
  depthTest: false,
});
const detachmentStonesKeys = Object.keys(detachmentStones);
fragments.meshes.forEach((mesh) => {
  if (detachmentStonesKeys.includes(mesh.uuid)) {
    mesh.material = detachmentMaterial;
  }
});
await classifier.byIfcRel(model, WEBIFC.IFCRELDEFINESBYPROPERTIES, "pset");
const lossStones = classifier.find({
  pset: ["Stone deterioration: Features induced by material loss"],
});
const lossMaterial = new THREE.MeshStandardMaterial({
  color: 0x684287,
  transparent: true,
  opacity: 0.5,
  depthTest: false,
});
const lossStonesKeys = Object.keys(lossStones);
fragments.meshes.forEach((mesh) => {
  if (lossStonesKeys.includes(mesh.uuid)) {
    mesh.material = lossMaterial;
  }
});
await classifier.byIfcRel(model, WEBIFC.IFCRELDEFINESBYPROPERTIES, "pset");
const discolorationStones = classifier.find({
  pset: ["Stone deterioration: Discoloration & deposit"],
});
const discolorationMaterial = new THREE.MeshStandardMaterial({
  color: 0x0084a9,
  transparent: true,
  opacity: 0.5,
  depthTest: false,
});
const discolorationStonesKeys = Object.keys(discolorationStones);
fragments.meshes.forEach((mesh) => {
  if (discolorationStonesKeys.includes(mesh.uuid)) {
    mesh.material = discolorationMaterial;
  }
});
await classifier.byIfcRel(model, WEBIFC.IFCRELDEFINESBYPROPERTIES, "pset");
const biologicalStones = classifier.find({
  pset: ["Stone deterioration: Biological colonization"],
});
const biologicalMaterial = new THREE.MeshStandardMaterial({
  color: 0x008e77,
  transparent: true,
  opacity: 0.5,
  depthTest: false,
});
const biologicalStonesKeys = Object.keys(biologicalStones);
fragments.meshes.forEach((mesh) => {
  if (biologicalStonesKeys.includes(mesh.uuid)) {
    mesh.material = biologicalMaterial;
  }
});

//1.5 Set up Highlighter :

const highlighter = components.get(OBF.Highlighter);
highlighter.setup({ world });

highlighter.events.select.onHighlight.add((fragmentIdMap) => {
  updatePropertiesTable({ fragmentIdMap });
});

highlighter.events.select.onClear.add(() => {
  updatePropertiesTable({ fragmentIdMap: {} });
});
highlighter.zoomToSelection = true;

//1.6 Add BIM Panel :

const indexer = components.get(OBC.IfcRelationsIndexer);
await indexer.process(model);
const [propertiesTable, updatePropertiesTable] = CUI.tables.elementProperties({
  components,
  fragmentIdMap: {},
});

propertiesTable.preserveStructureOnFilter = true;
propertiesTable.indentationInText = false;

const propertiesPanel = BUI.Component.create(() => {
  return BUI.html`
    <bim-panel label="Diagnostic study">
      <bim-panel-section label="According to the :">
        <a target="_blank"href="https://openarchive.icomos.org/id/eprint/434/1/Monuments_and_Sites_15_ISCS_Glossary_Stone.pdf">
        Illustrated glossary on stone deterioration patterns (ICOMOS-ISCS)
        </a>
      </bim-panel-section>
      <bim-panel-section label="Show/Hide stones by deterioration type">
        <bim-checkbox label="Crack & deformation"
          @change="${({ target }: { target: BUI.Checkbox }) => {
            if (modelAdded === false) {
              world.scene.three.add(model);
              hider.set(false, modelItems);
              modelAdded = true;
            }
            hider.set(target.value, crackStones);
            const crackOpacity = document.getElementById("crack-opacity");
            if (crackOpacity !== null && crackOpacity !== undefined) {
              if (target.value === true) {
                crackOpacity.style.display = "block";
              } else {
                crackOpacity.style.display = "none";
              }
            }
          }}">
        </bim-checkbox>
        <bim-number-input
          id="crack-opacity"
          style="display:none; margin-left:20px"
          slider step="0.01" label="Opacity" value="0.5" min="0" max="1"
          @change="${({ target }: { target: BUI.NumberInput }) => {
            crackMaterial.opacity = target.value;
          }}">
        </bim-number-input>
        <bim-checkbox label="Detachment"
          @change="${({ target }: { target: BUI.Checkbox }) => {
            if (modelAdded === false) {
              world.scene.three.add(model);
              hider.set(false, modelItems);
              modelAdded = true;
            }
            hider.set(target.value, detachmentStones);
            const detachmentOpacity =
              document.getElementById("detachment-opacity");
            if (detachmentOpacity !== null && detachmentOpacity !== undefined) {
              if (target.value === true) {
                detachmentOpacity.style.display = "block";
              } else {
                detachmentOpacity.style.display = "none";
              }
            }
          }}">
        </bim-checkbox>
        <bim-number-input
          id="detachment-opacity"
          style="display:none; margin-left:20px"
          slider step="0.01" label="Opacity" value="0.5" min="0" max="1"
          @change="${({ target }: { target: BUI.NumberInput }) => {
            detachmentMaterial.opacity = target.value;
          }}">
        </bim-number-input>
        <bim-checkbox label="Features induced by material loss"
          @change="${({ target }: { target: BUI.Checkbox }) => {
            if (modelAdded === false) {
              world.scene.three.add(model);
              hider.set(false, modelItems);
              modelAdded = true;
            }
            hider.set(target.value, lossStones);
            const lossOpacity = document.getElementById("loss-opacity");
            if (lossOpacity !== null && lossOpacity !== undefined) {
              if (target.value === true) {
                lossOpacity.style.display = "block";
              } else {
                lossOpacity.style.display = "none";
              }
            }
          }}">
        </bim-checkbox>
        <bim-number-input 
          id="loss-opacity"
          style="display:none; margin-left:20px"
          slider step="0.01" label="Opacity" value="0.5" min="0" max="1"
          @change="${({ target }: { target: BUI.NumberInput }) => {
            lossMaterial.opacity = target.value;
          }}">
        </bim-number-input>
        <bim-checkbox label="Discoloration & deposit"
          @change="${({ target }: { target: BUI.Checkbox }) => {
            if (modelAdded === false) {
              world.scene.three.add(model);
              hider.set(false, modelItems);
              modelAdded = true;
            }
            hider.set(target.value, discolorationStones);
            const discolorationOpacity = document.getElementById(
              "discoloration-opacity",
            );
            if (
              discolorationOpacity !== null &&
              discolorationOpacity !== undefined
            ) {
              if (target.value === true) {
                discolorationOpacity.style.display = "block";
              } else {
                discolorationOpacity.style.display = "none";
              }
            }
          }}">
        </bim-checkbox>
        <bim-number-input 
          id="discoloration-opacity"
          style="display:none; margin-left:20px"
          slider step="0.01" label="Opacity" value="0.5" min="0" max="1"
          @change="${({ target }: { target: BUI.NumberInput }) => {
            discolorationMaterial.opacity = target.value;
          }}">
        </bim-number-input>
        <bim-checkbox label="Biological colonization"
          @change="${({ target }: { target: BUI.Checkbox }) => {
            if (modelAdded === false) {
              world.scene.three.add(model);
              hider.set(false, modelItems);
              modelAdded = true;
            }
            hider.set(target.value, biologicalStones);
            const biologicalOpacity =
              document.getElementById("biological-opacity");
            if (biologicalOpacity !== null && biologicalOpacity !== undefined) {
              if (target.value === true) {
                biologicalOpacity.style.display = "block";
              } else {
                biologicalOpacity.style.display = "none";
              }
            }
          }}">
        </bim-checkbox>
        <bim-number-input 
          id="biological-opacity"
          style="display:none; margin-left:20px"
          color="#202932"
          slider step="0.01" label="Opacity" value="0.5" min="0" max="1"
          @change="${({ target }: { target: BUI.NumberInput }) => {
            biologicalMaterial.opacity = target.value;
          }}">
        </bim-number-input>
      </bim-panel-section>
      <bim-panel-section label="Informations on selected stones">
        ${propertiesTable}
      </bim-panel-section>
    </bim-panel>
  `;
});

//2. 3DTilesRenderer

//2.1 Extract Three.js tools from That Open Engine :

const scene = world.scene.three;
const camera = world.camera.three;
const renderer = world.renderer.three;

//2.1 Set up

const tilesRenderer = new TilesRenderer(
  "https://raw.githubusercontent.com/rvouilloz/hbim-viewer-fontainebleau/main/resources/models/tiled-photomesh/tileset.json",
);

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath(
  "https://raw.githubusercontent.com/rvouilloz/hbim-viewer-fontainebleau/main/resources/draco/gltf/",
);

const loader = new GLTFLoader(tilesRenderer.manager);
loader.setDRACOLoader(dracoLoader);

tilesRenderer.manager.addHandler(/\.gltf$/, loader);

tilesRenderer.setCamera(camera);
const resolutionVector = new THREE.Vector2(100, 100);
tilesRenderer.setResolution(camera, resolutionVector);
scene.add(tilesRenderer.group);

//2.2 Move the model on the IFC

tilesRenderer.group.rotateX((3 * Math.PI) / 2);
tilesRenderer.group.translateX(83.97);
tilesRenderer.group.translateY(-60.64);
tilesRenderer.group.translateZ(-103.84);

renderLoop();

function renderLoop() {
  requestAnimationFrame(renderLoop);
  camera.updateMatrixWorld();
  tilesRenderer.update();
  renderer.render(scene, camera);
}

//3. Add the app to the html :

const app = document.createElement("bim-grid");
app.layouts = {
  main: {
    template: `
    "propertiesPanel viewport"
    /25rem 1fr
    `,
    elements: { propertiesPanel, viewport },
  },
};

app.layout = "main";
document.body.append(app);

const loadingContainer = document.getElementById("loading-container");
if (loadingContainer !== null && loadingContainer !== undefined) {
  loadingContainer.style.display = "none";
}
