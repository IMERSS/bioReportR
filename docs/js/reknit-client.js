"use strict";

/* global Plotly */

// noinspection ES6ConvertVarToLetConst
var reknitr = fluid.registerNamespace("reknitr");
// noinspection ES6ConvertVarToLetConst
var hortis = fluid.registerNamespace("hortis");

/**
 * An integer
 *
 * @typedef {Number} Integer
 */

/**
 * A "call" structure instantiating an HTMLWidget
 *
 * @typedef {Object} HTMLWidgetCall
 * @property {String} method - The name of the method call
 * @property {Object[]} args - The arguments to the call
 */

/**
 * Information about a section element of a storymapping interface
 *
 * @typedef {Object} SectionHolder
 * @property {String} paneName - The name of the paneHandler for this section
 * @property {HTMLElement} section - The section node housing the widget
 * @property {HTMLElement} heading - The heading (currently h2 node) housing the widget
 * @property {String} headingText - The text of the heading node
 */

/**
 * Decoded information about a storymapping map widget
 *
 * @typedef {SectionHolder} MapWidgetInfo
 * @property {HTMLElement} [widget] - The DOM node holding the widget
 * @property {Object} data - The `data` entry associated with the map widget
 * @property {Array} subPanes - Any subpanes to which the widget's calls are allocated
 */

fluid.defaults("reknitr.htmlWidget", {
    gradeNames: "fluid.component",
    widgetKey: "{sourcePath}",
    events: {
        bindWidget: null
    },
    listeners: {
        "bindWidget.first": {
            priority: "first",
            func: "reknitr.htmlWidget.bindFirst"
        }
    }
});

/** Special marker grade that marks a pane's widgets to be slung into the special "data pane" area which is currently
 * below the map
 */
fluid.defaults("reknitr.dataPaneWidget", {
    gradeNames: "reknitr.htmlWidget",
    components: {
        storyPage: "{storyPage}",
        paneHandler: "{paneHandler}"
    },
    resizableWidthParent: ".mxcw-dataPane",
    dataPaneWidget: true
});

reknitr.htmlWidget.bindFirst = function (element, that) {
    that.element = element;
    if (that.options.dataPaneWidget) {
        const dataPane = that.storyPage.dataPanes[that.paneHandler.options.paneIndex];
        dataPane.appendChild(element);
    }
};

// Mixin grade for reknitr.htmlWidget
fluid.defaults("reknitr.withResizableWidth", {
    // TODO: Is .mxcw-dataPane for dataPaneWidget, wot no interactional grades
    resizableWidthParent: ".mxcw-sectionColumn",
    listeners: {
        "bindWidget.makeResizableWidth": {
            func: "reknitr.makeResizable",
            args: ["{that}", "{arguments}.0", "{paneHandler}", "{that}.options.resizableWidthParent", "width", "clientWidth"]
        }
    }
});

fluid.defaults("reknitr.withResizableHeight", {
    resizableHeightParent: ".mxcw-data",
    listeners: {
        "bindWidget.makeResizableHeight": {
            func: "reknitr.makeResizable",
            args: ["{that}", "{arguments}.0", "{paneHandler}", "{that}.options.resizableHeightParent", "height", "clientHeight"]
        }
    }
});

reknitr.findPlotlyWidgetId = function (widget) {
    return widget.layout?.meta?.mx_widgetId;
};

reknitr.makeResizable = function (widget, element, paneHandler, selector, property, measure) {
    // TODO: remove listener on destruction
    const resizeIt = function () {
        const parent = element.closest(selector);
        const newDimen = parent[measure];
        if (newDimen > 0) {
            Plotly.relayout(element, {[property]: newDimen});
        }
    };

    window.addEventListener("resize", resizeIt);
    // TODO: General notation for disposable effects
    fluid.pushArray(widget, "widgetEffects", fluid.effect(() => {
        fluid.invokeLater(resizeIt);
    }, fluid.computed(isVisible => isVisible || undefined, paneHandler.isVisible)));
};

fluid.defaults("reknitr.plotlySlider", {
    gradeNames: "reknitr.htmlWidget",
    members: {
        sliderIndex: "@expand:signal()",
        labels: "@expand:signal()"
    },
    listeners: {
        "bindWidget.impl": "reknitr.plotlySlider.bind"
    }
});

reknitr.plotlySlider.bind = function (element, that) {
    const slider = element;

    slider.on("plotly_sliderchange", function (e) {
        console.log("Slider change ", e);
        that.sliderIndex.value = e.slider.active;
        if (that.timer) {
            window.clearInterval(that.timer);
            delete that.timer;
        }
    });
    that.sliderIndex.value = 0;
    that.labels.value = element.layout.sliders[0].steps.map(step => step.label);
};

fluid.defaults("reknitr.withSliderAnimation", {
    delay: 1000,
    listeners: {
        "bindWidget.withSliderAnimation": {
            priority: "after:impl",
            funcName: "reknitr.withSliderAnimation.bind"
        }
    }
});

reknitr.withSliderAnimation.bind = function (element, that) {
    const limit = element.data.length;
    that.timer = window.setInterval(function () {
        if (that.isActive.value) {
            const current = element.layout.sliders[0].active;
            const next = (current + 1) % limit;
            // This updates the slider position and label, but not the plot
            Plotly.relayout(element, {"sliders.0.active": next});
            // This updates visibility of the plot - unknown why this doesn't happen from the former
            Plotly.restyle(element, {visible: element.layout.sliders[0].steps[next].args[1]});
            that.sliderIndex.value = next;
        }
    }, that.options.delay);
};

fluid.defaults("reknitr.choroplethSlider", {
    gradeNames: ["reknitr.plotlySlider", "hortis.obsFilter"],
    members: {
        // isActive: "@expand:signal()",
        // TODO: Interactional grade and syntax for this!
        isActive: "{paneHandler}.isVisible",
        queryCache: "@expand:fluid.computed(reknitr.choroplethSlider.queryCache, {that}.obsRows)",
        filterState: "@expand:fluid.computed(reknitr.choroplethSlider.deriveFilterState, {that}.sliderIndex, {that}.labels, {that}.queryCache)"
    },
    invokers: {
        doFilter: "reknitr.choroplethSlider.doFilter({arguments}.0, {arguments}.1)",
        reset: "fluid.identity()"
    }
});

reknitr.yearCache = Symbol("yearCache");

reknitr.choroplethSlider.queryCache = function (obsRows) {
    obsRows.forEach(row => row[reknitr.yearCache] = +row.eventDate.substring(0, 4));
    return obsRows.length;
};

reknitr.choroplethSlider.deriveFilterState = function (sliderIndex, labels) {
    return +labels[sliderIndex];
};

reknitr.choroplethSlider.doFilter = function (obsRows, filterState) {
    return filterState === null ? obsRows : obsRows.filter(row => row[reknitr.yearCache] <= filterState);
};

reknitr.findPlotlyWidgets = function (storyPage, sectionHolders) {
    const widgets = [...document.querySelectorAll(".html-widget.plotly")];
    const sections = fluid.getMembers(sectionHolders, "section");

    console.log("Found " + widgets.length + " plotly widgets");
    widgets.forEach(function (widgetNode) {
        const pane = widgetNode.closest(".section");
        const widgetId = reknitr.findPlotlyWidgetId(widgetNode);
        const index = sections.indexOf(pane);

        console.log("Plotly widget's pane index is " + index + " with id " + widgetId);
        const paneName = storyPage.sectionHolders[index].paneName;
        const paneHandler = paneName && reknitr.paneHandlerForName(storyPage, paneName);
        if (widgetId) {
            const handler = reknitr.widgetHandlerForName(paneHandler, widgetId);
            if (handler) {
                handler.events.bindWidget.fire(widgetNode, handler, paneHandler, storyPage);
            } else {
                console.log("No widget handler configured for widget with id ", widgetId);
            }
        } else {
            console.log("Warning: no widget id found for plotly widget ", widgetNode);
        }
    });
};

// No references, currently disused
fluid.defaults("reknitr.withNativeLegend", {
    modelListeners: {
        legendVisible: {
            path: "{paneHandler}.model.isVisible",
            func: "hortis.toggleClass",
            args: ["{that}.legendContainer", "mxcw-hidden", "{change}.value", true]
        }
    }
});

reknitr.decodePaneName = function (node) {
    const nameHolder = [...node.classList].find(clazz => clazz.startsWith("mxcw-paneKey-"));
    return nameHolder.substring("mxcw-paneKey-".length);
};

// Index the collection of sectionHolder structure by paneHandlerName
reknitr.sectionHoldersToIndex = function (sectionHolders) {
    const togo = {};
    sectionHolders.forEach(function (sectionHolder, index) {
        togo[sectionHolder.paneName] = index;
    });
    return togo;
};

/**
 * Decodes the document structure surrounding an array of DOM nodes representing map widgets
 * @param {reknitr.storyPage} storyPage - The overall storyPage component
 * @return {SectionHolder[]} An array of structures representing the section holders
 */
reknitr.mapSectionHolders = function (storyPage) {
    const sections = storyPage.locate("sections");
    console.log("Found " + sections.length + " sections");
    const togo = [...sections].map(function (section) {
        const heading = section.querySelector("h2");
        const paneName = reknitr.decodePaneName(section);
        return {
            section, heading, paneName,
            subPanes: [],
            headingText: heading.innerText
        };
    });
    return togo;
};

reknitr.mapPaneHandlers = function (storyPage) {
    return fluid.queryIoCSelector(storyPage, "reknitr.paneHandler", true);
};

/**
 * Toggles a CSS class on a collection of nodes, activating it only for the node at the selected index.
 * @param {Array<HTMLElement>} nodes - The array of DOM nodes to update.
 * @param {String} clazz - The CSS class to toggle.
 * @param {Number} selectedIndex - The index of the node to activate (add the class to); all others will have the class removed.
 * @param {Boolean} [inverse] - If `true`, invert presence of class. All nodes will be given the class *except* selectedIndex.
 */
reknitr.toggleActiveClass = function (nodes, clazz, selectedIndex, inverse) {
    nodes.forEach(function (node, i) {
        hortis.toggleClass(node, clazz, i === selectedIndex, inverse);
    });
};

reknitr.paneKeyToIndex = function (handler, storyPage) {
    const key = fluid.getForComponent(handler, "options.paneKey");
    const paneKeyToIndex = fluid.getForComponent(storyPage, "paneKeyToIndex");
    const index = paneKeyToIndex[key];
    if (index === undefined) {
        fluid.fail("Unable to look up section handler with name " + key + " to a data pane index");
    }
    return index;
};

/**
 * Given a paneHandler component, find its section holder
 * @param {reknitr.paneHandler} handler - The paneHandler to be looked up
 * @param {reknitr.storyPage} storyPage - The overall storyPage component
 * @return {jQuery} A jQuery-wrapped container node suitable for instantiating a component.
 */
reknitr.sectionForPaneHandler = function (handler, storyPage) {
    const index = reknitr.paneKeyToIndex(handler, storyPage);
    return fluid.container(storyPage.sectionHolders[index].section);
};

reknitr.paneHandlerForRegion = function (storyPage, region) {
    return storyPage.paneHandlers.find(handler => fluid.getForComponent(handler, "options.selectRegion") === region);
};

reknitr.paneHandlerForName = function (storyPage, paneName) {
    return storyPage.paneHandlers.find(handler => fluid.getForComponent(handler, "options.paneKey") === paneName);
};

reknitr.paneHandlerForIndex = function (storyPage, paneIndex) {
    return storyPage.paneHandlers.find(handler => fluid.getForComponent(handler, "options.paneIndex") === paneIndex);
};

reknitr.widgetHandlerForName = function (paneHandler, widgetId) {
    const widgetHandlers = fluid.queryIoCSelector(paneHandler, "reknitr.htmlWidget", true);
    return widgetHandlers.find(handler => fluid.getForComponent(handler, "options.widgetKey") === widgetId);
};

reknitr.allocateDataPanes = function (dataPanesHolder, storyPage) {
    // And in addition sling any statically declared widgets, e.g. the obs data table there
    const staticWidgets = [...document.querySelectorAll(".mxcw-data-pane-widget")];
    staticWidgets.forEach(widget => dataPanesHolder.appendChild(widget));

    return storyPage.paneHandlers.map((paneHandler) => {
        const dataPane = document.createElement("div");
        dataPane.classList.add("mxcw-dataPane");
        dataPane.classList.add("mxcw-dataPane-" + paneHandler.options.paneKey);
        dataPanesHolder.appendChild(dataPane);
        return dataPane;
    });
};


reknitr.unflattenOptions = function (records) {
    return fluid.transform(records, record => ({
        type: record.type,
        options: fluid.censorKeys(record, ["type"])
    }));
};

reknitr.resolvePaneHandlers = function () {
    // Written into the markup by reknitr.reknitFile in reknit.js
    const rawPaneHandlers = reknitr.rawPaneHandlers;
    return reknitr.unflattenOptions(rawPaneHandlers);
};

hortis.libreMap.layerToLabel = function (layers) {
    return Object.fromEntries(layers.filter(layer => layer.label).map(layer => [layer.id, layer.label]));
};

fluid.defaults("hortis.libreMap.withRegions", {
    members: {
        selectedRegion: "@expand:signal()",
        hoverRegion: "@expand:signal(null)",
        layerToLabel: "@expand:hortis.libreMap.layerToLabel({that}.options.mapOptions.style.layers)",
        highlightSelectedRegion: "@expand:fluid.effect(hortis.libreMap.highlightSelectedRegion, {that}.map, {that}.selectedRegion)"
    },
    components: {
        regionTooltip: {
            type: "hortis.tooltip",
            options: {
                tooltipKey: "hoverRegion",
                members: {
                    hoverRegion: "{withRegions}.hoverRegion"
                },
                invokers: {
                    renderTooltip: {
                        args: ["{withRegions}.layerToLabel", "{arguments}.0"],
                        func: (layerToLabel, id) => {
                            const label = layerToLabel[id];
                            return label ? `<div class="imerss-tooltip">${label}</div>` : null;
                        }
                    }
                }
            }
        }
    },

    listeners: {
        "onCreate.bindRegionSelect": "hortis.libreMap.bindRegionSelect({that})"
    }
});

hortis.libreMap.highlightSelectedRegion = function (map, selectedRegion) {
    if (map.getLayer("region-highlight")) {
        map.removeLayer("region-highlight");
    }
    if (selectedRegion) {
        map.addLayer({
            id: "region-highlight",
            type: "line",
            source: selectedRegion,
            paint: {
                "line-color": "yellow",
                "line-width": 3
            }
        });
    }
};

/**
 * Resolves a map event to the ID of the topmost visible, selectable region at the event's point.
 * @param {fluid.libreMap} map - Map component housing the MapLibre map
 * @param {MapMouseEvent} e - A map mouse event containing a `point` property.
 * @return {String|null} The region ID, or null if no selectable region was found.
 */
hortis.libreMap.eventToRegion = function (map, e) {
    const features = map.map.queryRenderedFeatures(e.point);
    const visibleFeatures = features.filter(feature => feature.layer.paint["fill-opacity"] > 0);
    const match = visibleFeatures.find(feature => map.options.selectableRegions.includes(feature.layer.id));
    return match?.layer.id || null;
};

hortis.libreMap.bindRegionSelect = function (that) {
    const map = that.map;

    map.on("mousemove", (e) => {
        const regionId = hortis.libreMap.eventToRegion(that, e);
        if (that.options.selectableRegions.includes(regionId)) {
            that.regionTooltip.hoverEvent = e.originalEvent;
            that.hoverRegion.value = regionId;
            map.getCanvas().style.cursor = regionId ? "pointer" : "";
        }
    });

    that.clickHandlers.push({
        handle: e => {
            const regionId = hortis.libreMap.eventToRegion(that, e);
            if (regionId) {
                that.selectedRegion.value = regionId;
                return true;
            }
        },
        reset: () => {
            that.selectedRegion.value = null;
            that.selectedStatus.value = null;
        }
    });

    map.getCanvas().addEventListener("mouseleave", () => hortis.clearAllTooltips(that.regionTooltip));
};


fluid.registerNamespace("reknitr.legendKey");

reknitr.legendKey.rowTemplate = `
<div class="imerss-legend-row %rowClass">
    <span class="imerss-legend-icon"></span>
    <span class="imerss-legend-preview %previewClass" style="%previewStyle"></span>
    <span class="imerss-legend-label">%keyLabel</span>
</div>`;

/**
 * Normalises a string to a valid CSS class name by lowercasing it, replacing any character that cannot appear in a CSS identifier with
 * a hyphen, collapsing consecutive hyphens, and trimming leading/ trailing hyphens.
 *
 * @param {String} str - The raw string to normalise.
 * @return {String} A lowercase, CSS-safe class name.
 */
hortis.normaliseToClass = function (str) {
    return str
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
};

/**
 * @typedef {Object} RegionInfo
 * @property {String} [fillColor] - The fill color for the region.
 * @property {String} [color] - The fallback color for the region if fillColor is not provided.
 * @property {String} [fillPatternUrl] - Optional URL for a fill pattern image.
 */

/**
 * Renders a legend row markup for a given region.
 *
 * @param {String} markup - The HTML template string for the legend row.
 * @param {RegionInfo} regionInfo - Information about the region, including color and optional fill pattern URL.
 * @param {String} regionKey - The name of the region to be displayed in the legend.
 * @param {String} regionName - The name of the region to be displayed in the legend.
 * @return {String} The rendered HTML markup for the legend row with appropriate classes and styles.
 *
 * This function generates a legend row by filling in the template with:
 * - A CSS class for the row and preview, normalized from the region name.
 * - Inline styles for background color and optional fill pattern.
 * - The display label for the region.
 */
reknitr.legendKey.renderMarkup = function (markup, regionInfo, regionKey, regionName) {
    const backColour = regionInfo.fillColor || regionInfo.color;
    const normal = hortis.normaliseToClass(regionKey);
    return fluid.stringTemplate(markup, {
        rowClass: "imerss-legend-row-" + normal,
        previewClass: "imerss-region-" + normal,
        previewStyle: (regionInfo.fillPatternUrl ? `background-image: url(${regionInfo.fillPatternUrl});\n` : "") + "background-color: " + backColour,
        keyLabel: regionName
    });
};

// cf. Xetthecum's hortis.legendKey.drawLegend in leafletMapWithRegions.js - it has a block template and also makes
// a fire to selectRegion with two arguments.
reknitr.legendKey.addLegendControl = function (map, regionRowsSignal, isVisibleSignal) {
    const control = reknitr.legendKey.drawLegend(map, regionRowsSignal, isVisibleSignal);
    control.onAdd = () => control.container;
    control.onRemove = () => {
        console.log("Cleaning up legend attached to ", control.container);
        control.cleanup();
    };

    map.map.addControl(control, "bottom-right");

    return control;
};

reknitr.indexRegionRows = function (regionRows) {
    return Object.fromEntries(regionRows.map(row => [row.regionKey, row]));
};

reknitr.legendKey.drawLegend = function (map, regionRowsSignal, isVisibleSignal) {
    const container = document.createElement("div");
    container.classList.add("mxcw-legend");
    container.classList.add("mxcw-region-legend");
    container.classList.add("maplibregl-ctrl"); // to ensure it receives pointer events

    const f = regionKey => {
        const rowSel = ".imerss-legend-row-" + hortis.normaliseToClass(regionKey);
        return container.querySelector(rowSel);
    };
    let bindSelectionEffect;

    const renderLegend = function (regionRows) {
        console.log("Rendering legend since " + regionRows.length + " rows have arrived");
        if (regionRows.length > 0) {

            regionRows.forEach(row => {
                if (row.fillPattern) {
                    row.fillPatternUrl = map.urlForFillPattern(row.fillPattern);
                }
            });
            const regionIndex = reknitr.indexRegionRows(regionRows);

            const regionMarkupRows = regionRows.map(function ({regionKey, regionLabel}) {
                return reknitr.legendKey.renderMarkup(reknitr.legendKey.rowTemplate, regionIndex[regionKey], regionKey, regionLabel || regionKey);
            });
            const markup = regionMarkupRows.join("\n");
            container.innerHTML = markup;

            const bindState = map[regionRows[0].bindState];

            regionRows.forEach(function ({regionKey}) {
                f(regionKey).addEventListener("click", function () {
                    bindState.value = regionKey;
                });
            });
            if (bindSelectionEffect) {
                bindSelectionEffect();
            }

            bindSelectionEffect = fluid.effect(function (selectedRegion) {
                regionRows.forEach(({regionKey}) => {
                    hortis.toggleClass(f(regionKey), "imerss-selected", selectedRegion === regionKey);
                });
            }, bindState.value);
        }

        isVisibleSignal.value = regionRows.length > 0;
    };

    fluid.effect(renderLegend, regionRowsSignal);
    fluid.effect(isVisible => hortis.toggleClass(container, "mxcw-hidden", !isVisible), isVisibleSignal);

    return {container};
};

// TODO: This has been designed wrongly, with a single multiplexed structure transmitted by "regionRows" - which
// then gets demultiplexed by the "bindState" member of the rows. It should be
// reorganised so that each paneHandler can have its own legend which then ends up being projected onto the map.
fluid.defaults("hortis.libreMap.regionLegend", {
    gradeNames: "fluid.component",
    members: {
        regionLegendRows: "@expand:signal([])",
        control: "@expand:reknitr.legendKey.addLegendControl({map}, {that}.regionLegendRows, {that}.isVisible)",
        isVisible: "@expand:signal(true)"
    }
});

fluid.defaults("hortis.libreMap.withRegionLegend", {
    components: {
        legend: {
            type: "hortis.libreMap.regionLegend"
        }
    }
});

reknitr.resolveMapboxData = function () {
    const data = reknitr.mapboxData;
    return fluid.copyImmutableResource(data);
};

fluid.defaults("hortis.libreMap.withMapboxData", {
    mapOptions: {
        style: "{that}.options.mapboxData.rootMap.x.layout.mapbox.style"
    }
});

reknitr.sectionNavMarkup = `
<nav class="chevron-nav" role="tablist" aria-label="Section navigation">
  <button class="chevron-tab" role="tab" aria-selected="false">Overview</button>
  <button class="chevron-tab" role="tab" aria-selected="false">History</button>
  <button class="chevron-tab active" role="tab" aria-selected="true">Explore Records</button>
  <button class="chevron-tab" role="tab" aria-selected="false">Recent Activity</button>
  <button class="chevron-tab" role="tab" aria-selected="false">Protected Areas</button>
</nav>
`;

reknitr.renderSectionNav = function (storyPage) {
    const tabs = storyPage.paneHandlers.map(paneHandler => `<button class="chevron-tab" role="tab" aria-selected="false">${paneHandler.options.shortTitle}</button>`).join("\n");
    const markup = `<nav class="chevron-nav" role="tablist" aria-label="Section navigation">${tabs}</nav>`;
    const sectionNav = storyPage.locate("sectionNav")[0];
    sectionNav.innerHTML = markup;
};

reknitr.updateSectionNav = function (that, activeSection) {
    const sectionNodes = [...that.locate("sectionNav")[0].querySelectorAll("button")];
    sectionNodes.forEach((sectionNode, index) => {
        hortis.toggleClass(sectionNode, "active", index === activeSection);
        sectionNode.setAttribute("aria-selected", index === activeSection ? "true" : "false");
    });
};


reknitr.listenSectionNav = function (that) {
    const sectionNodes = [...that.locate("sectionNav")[0].querySelectorAll("button")];
    sectionNodes.forEach((sectionNode, index) => {
        sectionNode.addEventListener("click", () => {
            that.applier.change("activeSection", index);
        });
    });
};


fluid.defaults("reknitr.storyPage", {
    gradeNames: ["fluid.viewComponent", "fluid.resourceLoader"],
    container: "body",
    // zoomDuration: 100,
    // selectableRegions: [],
    // fillPatternPath
    // mapFlavourGrade
    resources: {
        plotlyReady: {
            promiseFunc: "reknitr.HTMLWidgetsPostRender"
        }
    },
    //mapFlavourGrade: [],
    selectors: {
        sections: ".section.level2",
        dataPanesHolder: ".mxcw-data",
        heading: "h2",
        map: ".mxcw-map",
        mapHolder: ".mxcw-map-holder",
        contentHolder: ".mxcw-content-holder",
        content: ".mxcw-content",
        sectionNav: ".mxcw-section-nav"
    },
    components: {
        map: {
            type: "hortis.libreMap",
            options: {
                gradeNames: ["hortis.libreMap.inStoryPage", "{storyPage}.options.mapFlavourGrade"]

            }
        },
        hashManager: {
            type: "reknitr.hashManager"
        },
        resizeBar: {
            type: "hortis.resizeBar",
            options: {
                before: "{storyPage}.dom.map.0",
                axis: "vertical"
            }
        }
    },
    paneHandlerOptions: "@expand:reknitr.resolvePaneHandlers()",
    dynamicComponents: {
        paneHandlers: {
            sources: "{that}.options.paneHandlerOptions",
            type: "{source}.type",
            options: "{source}.options"
        }
    },
    members: {
        paneHandlers: "@expand:reknitr.mapPaneHandlers({that})",
        sectionHolders: "@expand:reknitr.mapSectionHolders({that})",
        dataPanes: "@expand:reknitr.allocateDataPanes({that}.dom.dataPanesHolder.0, {that})",
        paneKeyToIndex: "@expand:reknitr.sectionHoldersToIndex({that}.sectionHolders)",
        // state
        activePane: "@expand:signal()",
        activePaneHandler: "@expand:fluid.computed(reknitr.paneHandlerForIndex, {that}, {that}.activePane)",
        // "model listeners"

        updateActiveMapPane: "@expand:fluid.effect(reknitr.updateActiveMapPane, {that}, {that}.map, {that}.activePane, {that}.map.mapLoaded)",
        updateActiveDataPane: "@expand:fluid.effect(reknitr.updateActiveDataPane, {that}, {that}.activePane)",
        updateGridVisible: "@expand:fluid.effect(reknitr.updateGridVisible, {that}.map, {that}.activePaneHandler)",
        updatePaneVisibility: "@expand:fluid.effect(reknitr.updatePaneVisibility, {that}, {that}.activePaneHandler)",
        updateFiltersVisible: "@expand:fluid.effect(reknitr.updateFiltersVisible, {that}, {that}.activePaneHandler)",
        renderSectionNav: "@expand:reknitr.renderSectionNav({that})"
    },
    model: {
        // Currently this is at the head of updates - > activePane in model and then activePane signal
        activeSection: 0,
        activePane: 0,
        // Prevent the component trying to render until plotly's postRenderHandler has fired
        plotlyReady: "{that}.resources.plotlyReady.parsed"
    },
    modelListeners: {
        updateSectionClasses: {
            path: "activeSection",
            funcName: "reknitr.updateSectionClasses",
            args: ["{that}", "{change}.value"]
        },
        updateSectionNav: {
            path: "activeSection",
            funcName: "reknitr.updateSectionNav",
            args: ["{that}", "{change}.value"]
        },
        // Transmit the activePane model to the corresponding signal
        updateActivePaneSignal: {
            path: "activePane",
            args: ["{that}.activePane", "{change}.value"],
            func: (activePaneSignal, activePane) => {activePaneSignal.value = activePane;},
            priority: "last"
        },
        mapVisible: {
            path: "activePane",
            funcName: "reknitr.updateMapVisible",
            args: ["{that}", "{change}.value"],
            priority: "first" // ensure map becomes visible before we attempt to set its initial bounds
        },
        updatePaneHash: {
            // Close any open taxon panel - perhaps better to react to a change in activeSection instead,
            // but we will still have the standard difficulty of distinguishing an initial value
            path: "activePane",
            funcName: "reknitr.updatePaneHash",
            args: ["{storyPage}", "{hashManager}", "{change}.value"],
            excludeSource: "init"
        },
        listenPaneHash: {
            path: "{hashManager}.model.pane",
            funcName: "reknitr.listenPaneHash",
            args: ["{storyPage}", "{change}.value"]
        }
    },
    modelRelay: {
        // TODO: Abolish activePane since we can't trigger updates from it
        sectionToPane: {
            source: "activeSection",
            target: "activePane",
            funcName: "fluid.identity"
        }
    },
    listeners: {
        "onCreate.listenSectionNav": "reknitr.listenSectionNav({that})",
        "onCreate.findPlotlyWidgets": "reknitr.findPlotlyWidgets({that}, {that}.sectionHolders)"
    }
});

// Convert the HTMLWidgets postRenderHandler into a promise
reknitr.HTMLWidgetsPostRender = function () {
    const togo = fluid.promise();
    if (window.HTMLWidgets?.addPostRenderHandler) {
        window.HTMLWidgets.addPostRenderHandler(function () {
            togo.resolve(true);
        });
    } else {
        togo.resolve(true);
    }
    return togo;
};

reknitr.updateSectionClasses = function (that, activeSection) {
    reknitr.toggleActiveClass(that.sectionHolders.map(sectionHolder => sectionHolder.section), "mxcw-activeSection", activeSection);
};

reknitr.updatePaneHash = function (storyPage, hashManager, paneIndex) {
    const paneHandler = reknitr.paneHandlerForIndex(storyPage, paneIndex);
    const paneKey = paneHandler.options.paneKey;
    if (!fluid.globalInstantiator.hashSource) {
        // Blast the taxon in the hash since taxon selected for one panel will not be good for another
        fluid.replaceModelValue(hashManager.applier, [], {pane: paneKey, taxon: null});
    }
};

reknitr.listenPaneHash = function (storyPage, paneName) {
    const paneHandler = reknitr.paneHandlerForName(storyPage, paneName);
    const paneIndex = paneHandler ? paneHandler.options.paneIndex : 0;
    // TODO: Abolish distinction between pane indices and section indices
    storyPage.applier.change("activeSection", paneIndex);
};

reknitr.layerOpacityProperty = function (layer) {
    return layer.type === "line" ? "line-opacity" :
        layer.type === "fill" ? "fill-opacity" :
            layer.type === "raster" ? "raster-opacity" : null;
};

reknitr.updateActiveDataPane = function (that, activePane) {
    reknitr.toggleActiveClass(that.dataPanes, "fl-hidden", activePane, true);
};

reknitr.updateActiveMapPane = function (that, map, activePane) {
    const activePaneName = that.sectionHolders[activePane]?.paneName;

    const mapboxData = map.options.mapboxData;

    const layers = map.options.mapOptions.style.layers;
    const layerVisibility = mapboxData.layersByPaneId[activePaneName] || {};
    layers.forEach((layer) => {
        const opacityProp = reknitr.layerOpacityProperty(layer);
        if (opacityProp) {
            // TODO: possible optimisation here from maplibre-gl-dev.js
            //         this.style.setPaintProperty(layerId, name, value, options);
            //         return this._update(true);
            const origOpacity = layer.paint?.[opacityProp] ?? 1;
            map.map.setPaintProperty(layer.id, opacityProp, layerVisibility[layer.id] ? origOpacity : 0);
        }
    });

    // TODO: Perhaps assign these into paneHandlers if frequently used?
    const widgetData = mapboxData.mapWidgets[activePaneName]?.x.layout.mapbox;
    const currentZoom = map.map.getZoom();

    // Pretty terrible, there is no longer an ability to specify a callback: https://github.com/mapbox/mapbox-gl-js/issues/1794
    // API docs claim "maxDuration" but there is not
    const zoom = fluid.promise();
    if (widgetData) {
        if (map.hasBounds) {
            const zoomRatio = Math.abs(Math.log(currentZoom / widgetData.zoom));
            // For zooms greater than a certain magnitude, do a much slower zoom
            const zoomDuration = zoomRatio > 0.3 ? that.options.slowZoomDuration : that.options.zoomDuration;
            map.map.flyTo({
                center: widgetData.center,
                zoom: widgetData.zoom,
                duration: zoomDuration,
                // Awkward to override the prefersReducedMotion setting but taking OS setting by default seems too severe
                essential: true
            });
            map.map.once("moveend", () => {
                zoom.resolve();
            });
        } else {
            map.map.jumpTo({
                center: widgetData.center,
                zoom: widgetData.zoom
            });
            map.hasBounds = true;
            zoom.resolve();
        }
    } else {
        zoom.resolve();
    }

    zoom.then(function () {
        // TODO: We probably just want this to happen immediately
        // This is a hack to cause SVG plotly widgets to resize themselves e.g. the Species Reported bar -
        // find a better solution
        window.dispatchEvent(new Event("resize"));
    });
};

fluid.defaults("reknitr.obsMapPaneHandler", {
    gradeNames: "reknitr.paneHandler",
    visibleMap: true,
    visibleGrid: true,
    visibleObsFilters: true,
    visibleObsTable: true,
    visibleVizControls: true
});

fluid.defaults("reknitr.statusPaneHandler", {
    gradeNames: "reknitr.obsMapPaneHandler"
});

fluid.defaults("reknitr.solowPaneHandler", {
    gradeNames: "reknitr.paneHandler",
    visibleMap: true,
    visibleVizControls: true,
    visibleSolow: true
});

reknitr.visiblePropsToSelectors = {
    visibleVizControls: ".imerss-container",
    visibleSolow: ".mxcw-solow",
    visibleObsFilters: ".imerss-filter-panel"
};

reknitr.updatePaneVisibility = function (/*that, paneHandler*/) {
    // TODO: Generalise stuff from updateMapVisible via table above
};

reknitr.updateGridVisible = function (map, paneHandler) {
    map.gridVisible.value = !!paneHandler.options.visibleGrid;
};

reknitr.updateFiltersVisible = function (that, paneHandler) {
    const visibleFilters = paneHandler.options.visibleFilters;
    const filterNodes = document.querySelector(".imerss-filters");
    hortis.toggleClass(filterNodes, "fl-hidden", !visibleFilters);
    // Note that there was a terrible bug here with flat = true - we would end up iterating over
    // ALL the filters since filterRoot is injected inside filters and hence we hit the choroplethFilter also.
    // Hard to see what to do here - should make a qIS which doesn't follow "portals"?
    // And this kind of thing would always be in literal code, so how would we expect to trap it?
    const filters = fluid.queryIoCSelector(that.vizLoader.filters, "hortis.obsFilter", true);
    filters.map(filter => {
        if (!filter.options.alwaysActive) {
            filter.isActive.value = visibleFilters;
        }
    });

    const obsTableVisible = paneHandler.options.visibleObsTable;
    const obsTable = document.querySelector(".mxcw-obs-table-holder");
    hortis.toggleClass(obsTable, "fl-hidden", !obsTableVisible);
};

reknitr.updateMapVisible = function (that, activePane) {
    const paneHandler = reknitr.paneHandlerForIndex(that, activePane);
    if (!paneHandler) {
        fluid.fail("No pane handler found for section with index ", activePane);
    }
    hortis.toggleClass(that.dom.locate("mapHolder")[0], "mxcw-hideMap", paneHandler.options.visibleMap, true);
    hortis.toggleClass(document.querySelector(".imerss-container"), "fl-hidden", paneHandler.options.visibleVizControls, true);
    hortis.toggleClass(document.querySelector(".mxcw-solow-taxa"), "fl-hidden", paneHandler.options.visibleSolow, true);
    hortis.toggleClass(document.querySelector(".mxcw-solow-widgets-holder"), "fl-hidden", paneHandler.options.visibleSolow, true);

    that.vizLoader.solowMapLayer.layerVisible.value = !!paneHandler.options.visibleSolow;

    hortis.toggleClass(document.querySelector(".imerss-filter-panel"), "fl-hidden", paneHandler.options.visibleObsFilters, true);
    that.map.maxObsCountOverride.value = paneHandler.options.maxObsCountOverride;
};

// Base definitions

fluid.defaults("reknitr.paneHandler", {
    gradeNames: "fluid.viewComponent",
    paneKey: "{sourcePath}",
    paneIndex: "@expand:reknitr.paneKeyToIndex({that}, {reknitr.storyPage})",
    members: {
        container: "@expand:reknitr.sectionForPaneHandler({that}, {reknitr.storyPage})",
        isVisible: "@expand:signal()"
    },
    modelListeners: {
        isVisibleToSignal: {
            path: "isVisible",
            args: ["{that}.isVisible", "{change}.value"],
            func: (isVisibleSignal, isVisible) => {
                isVisibleSignal.value = isVisible;
            }
        },
        stopMedia: {
            path: "isVisible",
            args: ["{that}.options.parentContainer.0", "{change}.value"],
            func: "reknitr.stopMedia"
        }
    },

    modelRelay: {
        isVisible: {
            args: ["{reknitr.storyPage}.model.activePane", "{that}.options.paneIndex"],
            func: (activePane, paneIndex) => activePane === paneIndex,
            target: "isVisible"
        }
    },
    listeners: {
        "onCreate.addPaneClass": "reknitr.paneHandler.addPaneClass({that}, {that}.options.parentContainer)"
    },
    resolvedWidgets: "@expand:reknitr.unflattenOptions({that}.options.widgets)",
    dynamicComponents: {
        widgets: {
            sources: "{that}.options.resolvedWidgets",
            type: "{source}.type",
            options: "{source}.options"
        }
    },
    // For consistency when binding from withPaneInfo
    parentContainer: "{that}.container"
});

reknitr.stopMedia = function (container, isVisible) {
    if (!isVisible) {
        const audios = [...container.querySelectorAll("audio")];
        audios.forEach(audio => audio.pause());
    }
};

reknitr.paneHandler.addPaneClass = function (that, parentContainer) {
    parentContainer[0].classList.add("mxcw-widgetPane-" + that.options.paneKey);
};

fluid.defaults("reknitr.templatePaneHandler", {
    gradeNames: ["reknitr.paneHandler", "fluid.templateRenderingView"],
    parentContainer: "@expand:reknitr.sectionForPaneHandler({that}, {reknitr.storyPage})"
});

fluid.defaults("hortis.vizLoader.withRegions", {
    gradeNames: "hortis.vizLoader",
    components: {
        regionLoader: {
            type: "hortis.csvReader",
            options: {
                url: "{vizLoader}.options.regionFile"
            }
        }
    }
});

fluid.defaults("reknitr.hashManager", {
    gradeNames: "fluid.modelComponent",
    listeners: {
        "onCreate.listenHash": "reknitr.hashManager.listenHash"
    },
    invokers: {
        applyHash: "reknitr.hashManager.applyHash({that}, {arguments}.0)"
    },
    members: {
        // We don't get a notification on startup, ingest any hash present in the initial URL, but delay to avoid
        // confusing initial model resolution and map loading TODO improve with initial model merging if we can
        applyHashOnResources: "@expand:fluid.effect({that}.applyHash, load, {vizLoader}.resourcesLoaded)"
    },
    modelListeners: {
        "pushState": {
            path: "",
            funcName: "reknitr.hashManager.listenModel",
            args: ["{that}", "{change}.value"],
            excludeSource: "init"
        }
    }
});

reknitr.parseHashSegment = function (segment) {
    const [key, value] = decodeURIComponent(segment).split(":");
    const parsedValue = value.startsWith("{") || value.startsWith("[") ? JSON.parse(value) : value;
    return [key, parsedValue];
};

reknitr.renderHashSegment = function (key, value) {
    return key + ":" + (fluid.isPrimitive(value) ? "" + value : JSON.stringify(value));
};

reknitr.hashManager.applyHash = function (that) {
    const hash = location.hash.substring(1); // Remove initial # if any
    const sections = hash.split("&");
    const parsedSections = sections.filter(section => section.includes(":"))
        .map(section => reknitr.parseHashSegment(section));
    const model = Object.fromEntries(parsedSections);
    // We tried applying a transaction source here but there is a nested listener in reknitr.listenPaneHash and we
    // never implemented transaction globbing for https://fluidproject.atlassian.net/browse/FLUID-5498
    fluid.globalInstantiator.hashSource = true;
    fluid.replaceModelValue(that.applier, [], model);
    delete fluid.globalInstantiator.hashSource;
};

reknitr.hashManager.listenHash = function (that) {
    window.addEventListener("hashchange", () => {
        console.log("hashchange");
        that.applyHash();
    });
    window.addEventListener("popstate", () => {
        console.log("popstate");
        that.applyHash();
    });
};

reknitr.hashManager.listenModel = function (that, model) {
    const nonEmpty = Object.entries(model).filter(([, value]) => fluid.isValue(value));
    const segments = nonEmpty.map(([key, value]) => reknitr.renderHashSegment(key, value));
    const hash = "#" + segments.join("&");
    window.history.pushState(null, null, hash);
};
