/* eslint-env node */

"use strict";

const fs = require("fs-extra"),
    glob = require("glob"),
    path = require("path"),
    linkedom = require("linkedom"),
    yaml = require("js-yaml"),
    fluid = require("infusion");

const reknitr = fluid.registerNamespace("reknitr");

fluid.setLogging(true);

require("./utils.js");

/** Parse an HTML document supplied as a symbolic reference into a linkedom DOM document
 * @param {String} path - A possibly module-qualified path reference, e.g. "%reknitr/src/html/template.html"
 * @return {Document} The document parsed into a DOM representation
 */
reknitr.parseDocument = function (path) {
    const resolved = fluid.module.resolvePath(path);
    const text = fs.readFileSync(resolved, "utf8");
    return linkedom.parseHTML(text).document;
};

reknitr.parseYAMLFrontMatter = function (content) {
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    return match ? yaml.load(match[1]) : {};
};

reknitr.writeFile = function (filename, data) {
    fs.writeFileSync(filename, data, "utf8");
    const stats = fs.statSync(filename);
    console.log("Written " + stats.size + " bytes to " + filename);
};

fluid.delete = function (root, path) {
    const segs = fluid.model.pathToSegments(path);
    // TODO: Refactor away this silly interface too
    const pen = fluid.model.traverseSimple(root, segs, 0, null, 1);
    delete pen[fluid.peek(segs)];
};

reknitr.censorMapbox = function (data) {
    // TODO: Implement immutable applier
    const copy = fluid.copy(data);
    fluid.delete(copy, "x.layout.mapbox.style.sources");
    fluid.delete(copy, "x.layout.mapbox.style.layers");
    return copy;
};

reknitr.sortLayers = function (layers) {
    layers.sort((a, b) =>
        (+a.id.endsWith("-highlight") - (+b.id.endsWith("-highlight")))
    );
};


/**
 * @typedef {Object.<String, *>} RootMap
 * @typedef {Object.<String, LayerIdSet>} LayersByPaneId
 */

/**
 * @typedef {Object.<String, Number>} LayerIdSet
 */

/**
 * @typedef {Object.<String, Object>} MapWidgets
 */

/**
 * @typedef {Object.<String, Number>} FillPatterns
 */

/**
 * @typedef {Object} MapboxWidgetsParseResult
 * @property {RootMap} rootMap - The first Mapbox widget's data or an empty object if none are found.
 * @property {LayersByPaneId} layersByPaneId - A mapping of pane IDs to their associated layer IDs (with value 1).
 * @property {MapWidgets} mapWidgets - A mapping of pane IDs to their censored Mapbox data.
 * @property {FillPatterns} fillPatterns - A collection of fill pattern names as keys with value 1.
 */

reknitr.makeMapboxParseResults = function () {
    return {
        rootMap: null,
        mapWidgets: {},
        sources: {},
        layerHash: {},
        layersByPaneId:{},
        fillPatterns: {}
    };
};

/**
 * Parses Mapbox widgets from a given container element and processes their data.
 * This function identifies all Plotly widgets with Mapbox data, extracts and processes
 * their Mapbox-related information, and removes the original widgets from the DOM.
 * It also deduplicates sources, organizes layers, and prepares data for further use.
 *
 * @param {MapboxWidgetsParseResult} parseResults - Current parse results
 * @param {Element} container - The DOM container element to search for Mapbox widgets.
 */
reknitr.parseMapboxWidgets = function (parseResults, container) {
    const widgets = [...container.querySelectorAll(".html-widget.plotly")];
    let rootMap;
    const {mapWidgets, sources, layerHash, layersByPaneId, fillPatterns} = parseResults;

    widgets.forEach(widget => {
        const widgetId = widget.id;
        const dataNode = widgetId ? container.querySelector("[data-for=\"" + widgetId + "\"]") : null;
        //        console.log("Got data node ", dataNode);
        const data = dataNode ? JSON.parse(dataNode.innerHTML) : null;
        //        console.log("Got data ", data);
        const mapbox = fluid.get(data, "x.layout.mapbox");
        if (mapbox) {
            const paneId = mapbox.style.id;

            // Deduplicate all sources
            Object.entries(mapbox.style.sources).forEach(([key, value]) => {
                sources[key] = value;
            });
            mapbox.style.layers.forEach((layer) => {
                const key = layer.id;
                layerHash[key] = layer;
                fluid.set(layersByPaneId, [paneId, key], 1);
                const fillPattern = layer.paint?.["fill-pattern"];
                if (fillPattern) {
                    fillPatterns[fillPattern] = 1;
                }
            });
            if (!rootMap) {
                rootMap = data;
            }
            mapWidgets[paneId] = reknitr.censorMapbox(data);

            widget.remove();
            dataNode.remove();
        }
    });

    fluid.log("Parsed " + Object.keys(mapWidgets).length + " mapbox widgets from " + widgets.length + " plotly widgets");
};

reknitr.composeRootMap = function (parseResults) {
    const {mapWidgets, sources, layerHash, layersByPaneId, fillPatterns} = parseResults;
    const rootMap = {}; // originally took from first map encountered
    const layers = Object.values(layerHash);
    reknitr.sortLayers(layers);
    fluid.set(rootMap, "x.layout.mapbox.style.version", 8);
    fluid.set(rootMap, "x.layout.mapbox.style.sources", sources);
    fluid.set(rootMap, "x.layout.mapbox.style.layers", layers);

    return {rootMap, layersByPaneId, mapWidgets, fillPatterns};
};

// CURRENTLY DISUSED
/** Compute figures to move to data pane, by searching for selector `.data-pane`, and if any parent is found
 * with class `figure`, widening the scope to that
 * @param {Element} container - The DOM container to be searched for elements to move
 * @return {Element[]} - An array of DOM elements to be moved to the data pane
 */
reknitr.figuresToMove = function (container) {
    const toMoves = [...container.querySelectorAll(".data-pane")];
    const widened = toMoves.map(function (toMove) {
        const figure = toMove.closest(".figure");
        return figure || toMove;
    });
    return widened;
};

// CURRENTLY DISUSED
/** Move plotly widgets which have siblings which are maps into children of the .mxcw-data pane
 * @param {Document} template - The document for the template structure into which markup is being integrated
 * @param {Element[]} sections - The array of section elements found holding leaflet maps
 * @param {Element} container - The container node with class `.main-container` found in the original knitted markup
 * @return {Element[]} An array of data panes corresponding to the input section nodes
 */
reknitr.movePlotlyWidgets = function (template, sections, container) {
    const data = template.querySelector(".mxcw-data");
    if (!data) {
        throw "Error in template structure - data pane not found with class mxcw-data";
    }
    const dataDivs = sections.map(() => {
        const div = template.createElement("div");
        div.setAttribute("class", "mxcw-widgetPane");
        data.appendChild(div);
        return div;
    });

    const plotlys = [...container.querySelectorAll(".html-widget.plotly")];
    console.log("Found " + plotlys.length + " Plotly widgets in " + sections.length + " heading sections");
    const toDatas = reknitr.figuresToMove(container);
    console.log("Found " + toDatas.length + " elements to move to data pane");
    const toMoves = [...plotlys, ...toDatas];
    toMoves.forEach(function (toMove, i) {
        const closest = toMove.closest(".section.level2");
        const index = sections.indexOf(closest);
        console.log("Found section for plotly widget at index " + index);
        if (index !== -1) {
            toMove.setAttribute("data-section-index", "" + index);
            dataDivs[index].prepend(toMove);
        } else {
            console.log("Ignoring widget at index " + i + " since it has no sibling map");
        }
    });
    return dataDivs;
};


// Remove "style" attributes which include hard-coded dimensions on the outer node which prevents the
// widget being resized
reknitr.cleansePlotlyWidgets = function (container) {
    const plotlys = [...container.querySelectorAll(".html-widget.plotly")];
    console.log("Found " + plotlys.length + " Plotly widgets");
    plotlys.forEach(function (plotly) {
        plotly.removeAttribute("style");
    });
};

reknitr.makeCreateElement = function (dokkument) {
    return (tagName, props) => {
        const element = dokkument.createElement(tagName);
        Object.entries(props).forEach(([key, value]) => element.setAttribute(key, value));
        return element;
    };
};

// Move all children other than the heading itself into nested "sectionInner" node to enable 2-column layout
reknitr.encloseSection = function (container, paneKey, vizColumn) {
    const h = reknitr.makeCreateElement(container.ownerDocument);
    const section = container.querySelector(".section.level2");
    section.classList.add("mxcw-paneKey-" + paneKey);
    const children = [...section.childNodes].filter(node => node.tagName !== "H2");
    const inner = h("div", {"class": "mxcw-sectionInner"});
    section.appendChild(inner);
    // Move to inner column - perhaps optional behaviour
    const innerColumn = h("div", {"class": "mxcw-sectionColumn"});
    inner.appendChild(innerColumn);
    children.forEach(child => innerColumn.appendChild(child));
    if (vizColumn === "right") {
        const vizColumn = h("div", {"class": "mxcw-sectionColumn mxcw-vizColumn"});
        inner.appendChild(vizColumn);
    }
    const header = container.querySelector("#header");
    if (header) {
        header.remove();
    }
};

reknitr.transferNodeContent = function (container, template, selector) {
    const containerNode = container.querySelector(selector);
    const templateNode = template.querySelector(selector);
    templateNode.innerHTML = containerNode.innerHTML;
    containerNode.remove();
};

/**
 * Parses map data for a given pane key.
 * Attempts to load a JSON file named `${key}-mapData.json` from the `viz_data` directory.
 * If the file exists, extracts the top-level `view` and `regionField` properties,
 * and collects the IDs of layers marked as selectable.
 * Returns an object containing the top-level data and an array of selectable layer IDs.
 * If the file does not exist, returns empty objects.
 *
 * @param {String} key - The pane key used to locate the map data file.
 * @return {{topLevel: Object, selectable: String[]}} An object with `topLevel` map data and an array of selectable layer IDs.
 */
reknitr.parseMapData = function (key) {
    const plotDataFile = "%self/viz_data/" + key + "-mapData.json";
    const resolved = fluid.module.resolvePath(plotDataFile);
    let selectable = [],
        topLevel = {};
    if (fs.existsSync(resolved)) {
        const plotData = fluid.loadJSON5File(resolved);
        const topLevel = fluid.filterKeys(plotData, ["view", "regionField"]);
        const selectable = plotData.layers.filter(layer => layer.metadata?.selectable).map(layer => layer.id);
        return {topLevel, selectable};
    } else {
        console.log("mapData file for pane " + key + " not found at path " + resolved);
    }
    return {topLevel, selectable};
};

reknitr.unflattenOptions = function (records) {
    return fluid.transform(records, record => ({
        type: record.type,
        options: fluid.censorKeys(record, ["type"])
    }));
};

/**
 * @typedef {Object} StoryFileEntry
 * @property {String} htmlfile - The path to the HTML file.
 * @property {Object} frontMatter - The parsed YAML front matter from the corresponding Rmd file.
 * @property {String} paneKey - The pane key, typically the file name without extension.
 */

/**
 * Sorts an array of HTML file paths by the `weight` property in their corresponding YAML front matter.
 * For each HTML file, this function:
 *   - Determines the corresponding `.Rmd` file in the same directory.
 *   - Reads and parses the YAML front matter from the `.Rmd` file.
 *   - Constructs a `StoryFileEntry` object containing the HTML file path, parsed front matter, and pane key.
 * Returns an array of `StoryFileEntry` objects sorted by the `weight` property (ascending).
 *
 * @param {String[]} resolvedFiles - Array of resolved HTML file paths.
 * @return {StoryFileEntry[]} Sorted array of file entries with front matter and pane key.
 */
reknitr.sortedMatterForFiles = function (resolvedFiles) {
    const fileEntries = resolvedFiles.map(htmlfile => {
        const { dir, name } = path.parse(htmlfile);
        const paneKey = name;
        const rmdFile = path.format({ dir, name, ext: ".Rmd" });
        const rmdContent = fs.readFileSync(rmdFile, "utf8");
        const frontMatter = reknitr.parseYAMLFrontMatter(rmdContent);
        return { htmlfile, frontMatter, paneKey };
    });

    fileEntries.sort((a, b) => {
        const weightA = parseFloat(a.frontMatter.weight) || 0;
        const weightB = parseFloat(b.frontMatter.weight) || 0;
        return weightA - weightB;
    });
    return fileEntries;
};

reknitr.outputTypes = {
    fullDoc: {
        pre: "<!DOCTYPE html>\n",
        post: ""
    },
    hugoPartial: {
        pre: "{{ define \"main\" }}\n",
        post: "{{ end }}"
    }
};

reknitr.mapFrontMatter = function (frontMatter) {
    const layerNames = frontMatter.paneHandlerLayers || [];
    return {...fluid.censorKeys(frontMatter, ["knit", "paneHandlerLayers"]), ...{gradeNames: layerNames}};
};

reknitr.reknitFiles = async function (rec) {
    const {infiles, outfile, template, options} = rec;

    const templateDoc = reknitr.parseDocument(fluid.module.resolvePath(template));
    const target = templateDoc.querySelector(".mxcw-content");
    // Don't move, we currently put these inline
    // reknitr.movePlotlyWidgets(template, sections, container);

    const parseResults = reknitr.makeMapboxParseResults();
    const resolvedFiles = glob.sync(fluid.module.resolvePath(infiles));

    /** @type {StoryFileEntry[]} */
    const fileEntries = reknitr.sortedMatterForFiles(resolvedFiles);

    const paneInfo = fileEntries.map(({htmlfile, frontMatter, paneKey}) => {
        const document = reknitr.parseDocument(htmlfile);
        const container = document.querySelector(".main-container");

        reknitr.cleansePlotlyWidgets(container);
        // TODO: Maybe do transforms here

        reknitr.encloseSection(container, paneKey, options.vizColumn);
        reknitr.parseMapboxWidgets(parseResults, container);

        target.appendChild(container);
        return {...reknitr.mapFrontMatter(frontMatter), paneKey};
    });

    const paneInfoHash = Object.fromEntries(
        paneInfo.map(({ paneKey, ...rest }) => [paneKey, rest])
    );

    const mapboxData = reknitr.composeRootMap(parseResults);

    fluid.writeJSONSync("mapboxData.json", mapboxData);
    const mapboxDataVar = "reknitr.mapboxData = " + JSON.stringify(mapboxData) + ";\n";

    const paneHandlers = options.paneHandlers;
    let selectableRegions = {};
    if (paneHandlers) {
        const integratedHandlers = fluid.transform(paneHandlers, function (paneHandler, key) {
            const {topLevel, selectable} = reknitr.parseMapData(key);
            selectable.forEach(oneSelectable => selectableRegions[oneSelectable] = true);
            return {...paneHandler, ...paneInfoHash[key], ...topLevel};
        });
        const rawPaneHandlers = "reknitr.rawPaneHandlers = " + JSON.stringify(integratedHandlers) + ";\n";
        const storyPageOptions = options.storyPageOptions || {};
        if (options.components) {
            const unflattened = reknitr.unflattenOptions(options.components);
            storyPageOptions.components = unflattened;
        }
        storyPageOptions.selectableRegions = Object.keys(selectableRegions);
        const dataScriptNode = templateDoc.createElement("script");
        dataScriptNode.innerHTML = mapboxDataVar + rawPaneHandlers;

        const initScriptNode = templateDoc.querySelector(".reknitr-initBlock");
        // TODO: See if any signature was really supplied - but in practice this should just all be set from the config if necessary
        const text = `reknitr.storyPage("body", ${JSON.stringify(storyPageOptions, null, 2)})\n`;
        initScriptNode.innerHTML = text;

        initScriptNode.parentNode.insertBefore(dataScriptNode, initScriptNode);
    }
    const outputType = rec.outputType || "fullDoc";
    const outMarkup = reknitr.outputTypes[outputType].pre + templateDoc.documentElement.outerHTML + reknitr.outputTypes[outputType].post;
    reknitr.writeFile(fluid.module.resolvePath(outfile), outMarkup);
};

// TODO: copy up synchronous copyGlob
const copyGlob = function (sourcePattern, targetDir) {
    console.log("copyGlob ", sourcePattern);
    const fileNames = glob.sync(sourcePattern);
    console.log("Got files ", fileNames);
    fileNames.forEach(filePath => {
        const fileName = path.basename(filePath);
        const destinationPath = path.join(targetDir, fileName);

        fs.ensureDirSync(path.dirname(destinationPath));
        fs.copyFileSync(filePath, destinationPath);
        console.log(`Copied file: ${fileName}`);
    });
};

/** Copy dependencies into docs directory for GitHub pages **/

const copyDep = function (source, target, replaceSource, replaceTarget) {
    const targetPath = fluid.module.resolvePath(target);
    const sourceModule = fluid.module.refToModuleName(source);
    if (sourceModule && sourceModule !== "self") {
        require(sourceModule);
    }
    const sourcePath = fluid.module.resolvePath(source);
    if (replaceSource) {
        const text = fs.readFileSync(sourcePath, "utf8");
        const replaced = text.replace(replaceSource, replaceTarget);
        fs.writeFileSync(targetPath, replaced, "utf8");
        console.log(`Copied file: ${targetPath}`);
    } else if (sourcePath.includes("*")) {
        copyGlob(sourcePath, targetPath);
    } else {
        fs.ensureDirSync(path.dirname(targetPath));
        fs.copySync(sourcePath, targetPath);
        console.log(`Copied file: ${targetPath}`);
    }
};

const reknit = async function () {
    const config = fluid.loadJSON5File("%self/config.json5");
    await fluid.asyncForEach(config.reknitJobs, async (rec) => reknitr.reknitFiles(rec));

    config.copyJobs.forEach(function (dep) {
        copyDep(dep.source, dep.target, dep.replaceSource, dep.replaceTarget);
    });
};

reknit().then();
