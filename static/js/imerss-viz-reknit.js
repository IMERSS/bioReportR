"use strict";
/* global Plotly, Papa */

// noinspection ES6ConvertVarToLetConst // otherwise this is a duplicate on minifying
var reknitr = fluid.registerNamespace("reknitr");
// noinspection ES6ConvertVarToLetConst // otherwise this is a duplicate on minifying
var hortis = fluid.registerNamespace("hortis");

// Main integration point for imerss-bioinfo "vizLoader" coexisting with storyPage infrastructure
fluid.defaults("reknitr.storyPage.withVizLoader", {
    components: {
        // Inject this outwards so that we can forward selectedRegion onto it
        regionFilter: "{vizLoader}.filters.regionFilter",
        vizLoader: {
            type: "hortis.blitzVizLoader",
            container: ".imerss-container",
            options: {
                selectors: {
                    // Inject the outer literal node to stop it looking inside its container
                    map: "{storyPage}.dom.map"
                },
                gridResolution: "{storyPage}.options.gridResolution",
                components: {
                    // Assume that it must be a vizLoaderWithMap
                    map: {
                        // Forward these options which used to be assigned to our nested map
                        options: {
                            gradeNames: ["hortis.libreMap.inStoryPage", "{storyPage}.options.mapFlavourGrade"]
                        }
                    },
                    // TODO configure these away for Howe Sound, needs to be viz-dependent
                    tabs: {
                        type: "fluid.emptySubcomponent"
                    },
                    blitzRecords: {
                        type: "fluid.emptySubcomponent"
                    },
                    recordReporter: {
                        type: "hortis.recordAndTaxaReporter",
                        options: {
                            members: {
                                taxa: "{vizLoader}.taxaFromObs",
                                taxaById: "{vizLoader}.taxa.rowById"
                            }
                        }
                    },
                    // Override definition in hortis.standardVizLoader which is a base grade of hortis.blitzVizLoader
                    filters: {
                        type: "reknitr.storyObsFilters",
                        options: {
                            components: {
                                regionFilter: {
                                    options: {
                                        fieldNames: "{storyPage}.options.regionFilterFieldNames"
                                    }
                                }
                            }
                        }
                    },
                    obsTable: {
                        type: "hortis.dataTable",
                        options: {
                            parentContainer: ".mxcw-obs-table",
                            members: {
                                rows: "{vizLoader}.finalFilteredObs"
                            }
                        }
                    }
                }
            }
        },
        // Inject out the inner map so that modelListeners etc. can bind to it
        // Note that this completely overwites the story's map
        map: "{storyPage}.vizLoader.map"
    },
    selectors: {
        downloadObsButton: ".mxcw-obs-table-holder .imerss-download-button"
    },
    listeners: {
        "onCreate.bindObsDownload": "reknitr.storyPage.bindObsDownloadClick"
    },
    modelListeners: {
        listenRegionHash: {
            path: "{hashManager}.model.region",
            func: (map, selectedRegion) => map.selectedRegion.value = selectedRegion || null,
            args: ["{map}", "{change}.value"]
        }
    },

    members: {
        relayStatusToFilter: "@expand:fluid.effect(reknitr.relayStatusToFilter, {map}.selectedStatus, {storyPage}.vizLoader.filters.statusFilter)",
        // Abominable failure of bidirectionality
        relayFilterToStatus: "@expand:fluid.effect(reknitr.relayFilterToStatus, {storyPage}.vizLoader.filters.statusFilter.filterState, {map})",
        relayRegionsToLegend: "@expand:fluid.effect(reknitr.relayRegionsToLegend, {map}, {vizLoader}.regionIndirection.rows, {storyPage}.activePaneHandler, {map}.mapLoaded)",
        relayRegionToHash: "@expand:fluid.effect(reknitr.relayRegionToHash, {hashManager}, {map}.selectedRegion)"
    }
});

reknitr.summaryTaxaRows = function (rows) {
    return rows.filter(row => row.inSummary);
};

fluid.defaults("reknitr.vizLoader.withSolow", {
    members: {
        filteredTaxa: "{taxaFiltersHolder}.filters.allOutput"
    },
    components: {
        taxaFiltersHolder: {
            type: "reknitr.howeTaxaFiltersHolder",
            options: {
                parentContainer: ".mxcw-solow-taxa"
            }
        },
        taxaTable: {
            type: "hortis.dataTable",
            options: {
                parentContainer: ".mxcw-solow-taxa",
                sortable: true,
                rowSelectable: true,
                columns: "{vizLoader}.options.taxonColumns",
                members: {
                    rows: "{vizLoader}.filteredTaxa",
                    sortColumn: "@expand:signal(direct_solow_ep)",
                    sortDirection: "@expand:signal(-1)"
                }
            }
        },
        solowRadius: {
            type: "reknitr.solowRadius",
            options: {
                parentContainer: ".mxcw-solow-radius-holder"
            }
        },
        solowTaxonInfo: {
            type: "reknitr.solowTaxonInfo",
            options: {
                parentContainer: ".mxcw-solow-taxon-holder",
                members: {
                    selectedTaxon: "{vizLoader}.taxaTable.selectedRow",
                    rowById: "{vizLoader}.taxa.rowById",
                    obsRows: "{vizLoader}.obsRows"
                }
            }
        },
        solowMapLayer: {
            type: "reknitr.solowMapLayer",
            options: {
                components: {
                    map: "{vizLoader}.map"
                },
                members: {
                    solowRadius: "{solowRadius}.radius",
                    taxonObsRows: "{solowTaxonInfo}.taxonObsRows"
                }
            }
        }
    }
});

reknitr.storyPage.bindObsDownloadClick = function (that) {
    that.dom.locate("downloadObsButton").on("click", () =>
        reknitr.storyPage.triggerObsDownload(that)
    );
};

reknitr.storyPage.triggerObsDownload = function (that) {
    const data = that.vizLoader.finalFilteredObs.value;
    const text = Papa.unparse(data);
    hortis.triggerDownload(text, "text/csv;charset=utf-8;", "observations.csv");
};

fluid.defaults("reknitr.statusFilter", {
    gradeNames: ["hortis.statusFilter", "hortis.obsDrivenFilter", "hortis.repeatingRowFilter", "fluid.stringTemplateRenderingView"],
    members: {
        // selectedStatus
        taxaById: "{taxa}.rowById",
        filterRows: [
            {id: "confirmed", label: "confirmed"},
            {id: "unconfirmed", label: "historical"},
            {id: "new", label: "new"}
        ],
        renderModel: `@expand:fluid.computed(reknitr.statusFilter.renderModel, {that}.selectedStatus, {that}.filterRows,
            {that}.options.markup, {that}.options.filterName)`
    },
    filterName: "Status",
    markup: {
        container: `
        <div class="imerss-status-filter">
            <div class="imerss-filter-title">%filterName:</div>
            <div class="imerss-filter-body imerss-region-filter-rows">%rows</div>
        </div>
        `
    },
    listeners: {
        "onCreate.bindClick": "reknitr.statusFilter.bindClick({that}, {that}.selectedStatus)"
    }
});

reknitr.statusFilter.renderModel = function (selectedStatus, filterRows, markup, filterName) {
    return {
        filterName,
        rows: filterRows.map(row =>
            hortis.repeatingRowFilter.renderRow(markup.row, row.label, row.id, selectedStatus === row.id ? "selected" : "unselected")).join("\n")
    };
};

reknitr.statusFilter.bindClick = function (that, selectedStatus) {
    that.container.on("click", ".pretty input", function () {
        const id = this.dataset.rowId;
        const oldStatus = selectedStatus.peek();
        fluid.log("Status filter clicked with row " + id);
        selectedStatus.value = id === oldStatus ? null : id;
    });
};

reknitr.storyObsFiltersTemplate = `
    <div class="imerss-filters">
        <div class="imerss-filter"></div>
        <div class="imerss-status-filter imerss-filter"></div>
        <div class="imerss-collector-filter imerss-filter"></div>
        <div class="imerss-region-filter imerss-filter"></div>
    </div>
`;

fluid.defaults("reknitr.storyObsFilters", {
    gradeNames: ["hortis.obsFilters", "fluid.stringTemplateRenderingView"],
    markup: { // Clearly unsatisfactory, have to move over to preactish rendering before long
        container: reknitr.storyObsFiltersTemplate,
        fallbackContainer: reknitr.storyObsFiltersTemplate
    },
    members: {
        obsRows: "{vizLoader}.obsRows"
    },
    selectors: {
        collectorFilter: ".imerss-collector-filter",
        regionFilter: ".imerss-region-filter",
        statusFilter: ".imerss-status-filter"
    },
    components: {
        filterRoot: "{storyPage}", // allow for filters in panes e.g. choropleth
        statusFilter: {
            type: "reknitr.statusFilter",
            container: "{that}.dom.statusFilter",
            options: {
                members: {
                    selectedStatus: "{storyPage}.map.selectedStatus"
                }
            }
        },
        collectorFilter: {
            type: "hortis.collectorFilter",
            container: "{that}.dom.collectorFilter",
            options: {
                filterName: "Recorder",
                fieldName: "recordedBy"
            }
        },
        regionFilter: { // this one is hidden, just used for state
            type: "hortis.regionFilter",
            container: "{that}.dom.regionFilter",
            options: {
                filterName: "Region",
                fieldNames: ["region"],
                alwaysActive: true, // don't hide this along with others
                members: {
                    indirectionRows: "{regionIndirection}.rows",
                    isActive: "@expand:signal(true)"
                }
            }
        }
    }
});


// legend/widget names: confirmed/historical/new
// filter names: confirmed/unconfirmed/new
reknitr.relayStatusToFilter = function (selectedStatus, statusFilter) {
    const newFilterState = {
        confirmed: false,
        new: false,
        unconfirmed: false
    };
    if (selectedStatus) {
        newFilterState[selectedStatus] = true;
    }
    fluid.each(newFilterState, (value, key) => statusFilter[key].value = value);
};


// Listen for reset status and relay it back onto map
reknitr.relayFilterToStatus = function (filterState, map) {
// Counts the number of true flags in filterState using reduce
    const flagsSet = Object.values(filterState).reduce((count, flag) => count + (flag === true ? 1 : 0), 0);
    if (flagsSet === 0) {
        map.selectedStatus.value = null;
    }
};

reknitr.relayRegionToHash = function (hashManager, selectedRegion) {
    hashManager.applier.change("region", selectedRegion);
};

reknitr.mapboxColorToCSS = function ({ r, g, b, a }) {
    const to255 = (v) => Math.round(v * 255);
    return `rgba(${to255(r)}, ${to255(g)}, ${to255(b)}, ${a})`;
};

// Map is assumed to be a hortis.libreMap.regionLegend
reknitr.relayRegionsToLegend = function (map, regionIndirection, activePaneHandler) {
    let regionLegendRows = [];
    const regionField = activePaneHandler.options.regionField;
    if (regionField) {
        if (regionField === "!statusAsRegion") {
            const colours = activePaneHandler.options.statusColors;
            // TODO: Fix this in the front matter to properly separate key/label
            regionLegendRows = Object.entries(colours).map(([regionLabel, fillColor]) => ({
                regionKey: regionLabel === "historical" ? "unconfirmed" : regionLabel,
                regionLabel,
                fillColor,
                bindState: "selectedStatus"
            }));
        } else {
            const rows = regionIndirection;
            regionLegendRows = rows.filter(row => row.regionField === regionField).map(row => {
                const regionKey = row.label;
                const layer = map.map.getLayer(regionKey);
                const rawColor = layer.paint._values["fill-color"].value.value;
                return {
                    regionKey,
                    fillColor: reknitr.mapboxColorToCSS(rawColor),
                    bindState: "selectedRegion"
                };
            });
        }
    }
    map.legend.regionLegendRows.value = regionLegendRows;
};

/** Forward all configuration from storyMap's map onto viz's map */
fluid.defaults("hortis.libreMap.inStoryPage", {
    gradeNames: "hortis.libreMap",
    container: "{storyPage}.dom.map",
    zoomDuration: "{storyPage}.options.zoomDuration",
    selectableRegions: "{storyPage}.options.selectableRegions",
    fillPatternPath: "{storyPage}.options.fillPatternPath",
    mapboxData: "@expand:reknitr.resolveMapboxData()",
    fillPatterns: "{that}.options.mapboxData.fillPatterns",
    style: {
        transition: {
            duration: "{that}.options.zoomDuration"
        }
    },
    // TODO: Infusion bug - the member declaration for zoomToObsBounds below should work but it doesn't since we don't use C3 properly
    // and options supplied by a subcomponent override as seen above should take priority over any internal grade names
    distributeOptions: {
        target: "{that}.options.members.zoomToObsBounds",
        record: "@expand:signal()"
    },

    members: {
        // Primary state for status selection
        selectedStatus: "@expand:signal(null)",
        regionSelectionEffect: "@expand:fluid.effect(reknitr.forwardRegionSelection, {storyPage}.regionFilter, {that}.selectedRegion)",
        // Prevent the map zooming to selected obs
        zoomToObsBounds: "@expand:signal()"
    }
});

reknitr.forwardRegionSelection = function (regionFilter, selectedRegion) {
    let filterState = {};
    if (selectedRegion) {
        const regionIndex = regionFilter.filterRows.value.findIndex(row => row.label === selectedRegion);
        if (regionIndex !== -1) {
            filterState = {[regionIndex]: true};
        }
    }
    regionFilter.filterState.value = filterState;
};

// A pane holding some kind of viz from imerss-viz - now just a simple template loader
fluid.defaults("reknitr.storyVizPane", {
    gradeNames: ["reknitr.templatePaneHandler"],
    resourceBase: ".",
    //
    resourceOptions: {
        terms: {
            resourceBase: "{that}.options.resourceBase"
        }
    },
    styles: {
        paneClass: "mxcw-viz-pane"
    },
    resources: {
        template: {
            url: "{that}.options.markupTemplate",
            dataType: "text"
        }
    },
    model: {
    },
    listeners: {
        "onCreate.paneClass": {
            func: (parentContainer, clazz) => parentContainer[0].classList.add(clazz),
            args: ["{that}.options.parentContainer", "{that}.options.styles.paneClass"]
        }
    }
});

// Grade applied to the base storyPage routing a taxon selection to selectedTaxonId signal in a pane
fluid.defaults("reknitr.storyPage.withPaneTaxon", {
    members: {
        taxaByName: "@expand:fluid.computed(hortis.taxaByName, {vizLoader}.taxaRows)"
    },
    modelListeners: {
        listenTaxonHash: {
            priority: "first",
            path: "{hashManager}.model",
            funcName: "reknitr.listenTaxonHash",
            args: ["{storyPage}", "{change}.value", "{storyPage}.taxaByName.value"]
        }
    }
});

hortis.taxaByName = function (taxaRows) {
    const taxaByName = {};
    taxaRows.forEach(row => taxaByName[row.iNaturalistTaxonName] = row);
    return taxaByName;
};

// Listen to this first so that taxon pane is ready before we make it visible
reknitr.listenTaxonHash = function (storyPage, hashModel, taxaByName) {
    const paneHandler = reknitr.paneHandlerForName(storyPage, hashModel.pane);
    if (paneHandler?.selectedTaxonId) {
        const row = taxaByName[hashModel?.taxon];
        const taxonId = row?.id;
        // Put in null explicitly to avoid censoring by fluid.effect
        paneHandler.selectedTaxonId.value = taxonId || null;
    }
};

reknitr.updateTaxonHash = function (hashManager, taxaById, selectedTaxonId, isVisible) {
    if (isVisible) {
        const taxonName = taxaById[selectedTaxonId]?.iNaturalistTaxonName;
        hashManager.applier.change("taxon", taxonName);
    }
};


// AS has requested the region selection bar to appear in a special area above the taxonomy
fluid.defaults("reknitr.regionSelectionBar.withHoist", {
    gradeNames: "reknitr.htmlWidget",
    listeners: {
        "bindWidget.hoist": {
            funcName: "reknitr.regionSelectionBar.hoist",
            priority: "before:impl"
        }
    },
    resizableWidthParent: ".imerss-checklist-outer"
});

reknitr.regionSelectionBar.hoist = function (element, that, paneHandler) {
    const target = paneHandler.container[0].querySelector(".imerss-checklist-widgets");
    target.appendChild(element);
};

fluid.defaults("reknitr.regionSelectionBar", {
    gradeNames: ["reknitr.htmlWidget", "reknitr.withResizableWidth"],
    listeners: {
        "bindWidget.impl": "reknitr.regionSelectionBar.bind"
    }
    //,
    // members: {
    //    selectedStatus: .... - currently configured in config.json5
    // }
});

reknitr.regionSelectionBar.bind = function (element, that) {
    const names = fluid.getMembers(element.data, "name");
    that.showStatusEffects = names.map((oneStatus, index) =>
        fluid.effect(selectedStatus => {
            const selected = selectedStatus === oneStatus;
            Plotly.restyle(element, {
                // Should agree with .imerss-selected but seems that plotly cannot be reached via CSS
                "marker.line": selected ? {
                    color: "#FCFF63",
                    width: 2
                } : {
                    color: "#000000",
                    width: 0
                }
            }, index);
        }
        , that.selectedStatus));

    element.on("plotly_click", function (e) {
        const statusName = e.points[0].data.name;
        that.selectedStatus.value = statusName;
    });
};

fluid.defaults("reknitr.bareRegionsExtra.withLegend", {
    selectors: {
        // key is from Xetthecum, selector is ours - we don't have "keys", normalise this
        legendKeys: ".mxcw-legend"
    },
    modelListeners: {
        legend: {
            path: "selectedRegions.*",
            func: "hortis.legendKey.selectRegion",
            args: ["{that}", "{change}.value", "{change}.path"]
        },
        legendVisible: {
            path: "{paneHandler}.model.isVisible",
            func: "hortis.toggleClass",
            args: ["{that}.legendContainer", "mxcw-hidden", "{change}.value", true]
        }
    },
    members: {
        legendContainer: "@expand:reknitr.legendKey.drawLegend({that}, {paneHandler})"
    },
    listeners: {
        // BUG only one of the legendVisible modelListeners fires onCreate! Perhaps because of the namespace?
        "onCreate.legendVisible": {
            path: "{paneHandler}.model.isVisible",
            func: "hortis.toggleClass",
            args: ["{that}.legendContainer", "mxcw-hidden", "{paneHandler}.model.isVisible", true]
        }
    }
});

// Ancient thing, vizColumn no longer exists
reknitr.addToVizColumn = function (parentContainer, jNode) {
    const target = parentContainer.find(".mxcw-vizColumn");
    target.append(jNode);
};

fluid.defaults("hortis.taxonDisplay.withClose", {
    selectors: {
        close: ".imerss-taxonDisplay-close"
    },
    markup: { /** TODO: This should probably be in a snippet/resource */
        taxonDisplayHeader:
            `<div class="imerss-taxonDisplay-close">
                <div>close</div>
                <div class="imerss-taxonDisplay-x">
                    <svg width="20" height="20">
                        <use href="#close-x" />
                    </svg>
                </div>
            </div>`
    },
    listeners: {
        "onCreate.bindClose": {
            args: ["{that}.container", "{that}.options.selectors.close", "{that}.selectedTaxonId"],
            /* TODO: Materialise all delegates! */
            func: (container, close, selectedTaxonId) => container.on("click", close, () => selectedTaxonId.value = null)
        }
    }
});

// Abstractish base grade common between those which can display info on a taxon in toggleable panel
fluid.defaults("reknitr.paneWithTaxonDisplay", {
    selectors: {
        taxonDisplay: ".imerss-taxonDisplay",
        panels: ".imerss-panel",
        sectionInner: ".mxcw-sectionInner",
        legends: ".imerss-map-legend"
    },
    // defaultPanel
    members: {
        selectedTaxonId: "@expand:signal(null)",
        panelHash: "@expand:reknitr.panelsToHash({that}.dom.panels)",
        paneSelect: "@expand:fluid.effect(reknitr.taxonToPanel, {that}.options.defaultPanel, {that}.panelHash, {that}.selectedTaxonId)",
        updateTaxonHash: "@expand:fluid.effect(reknitr.updateTaxonHash, {hashManager}, {vizLoader}.taxa.rowById, {that}.selectedTaxonId, {that}.isVisible)",
        rewriteTaxonLinks: `@expand:fluid.effect(reknitr.rewriteTaxonLinks, {that}.options.parentContainer,
             {that}.options.paneKey, {storyPage}.taxaByName, {that}.regionTaxa, {vizLoader}.resourcesLoaded)`,
        instantiateLegends: `@expand:fluid.effect(reknitr.paneHandler.instantiateLegends, {that}, {map}, {vizLoader}.regionLoader,
             {vizLoader}.resourcesLoaded)`
    },
    invokers: {
        // override from fluid.containerRenderingView
        addToParent: "reknitr.addToVizColumn({that}.options.parentContainer, {arguments}.0)"
    },
    components: {
        taxonDisplay: {
            type: "hortis.taxonDisplay",
            container: "{that}.dom.taxonDisplay",
            options: {
                gradeNames: "hortis.taxonDisplay.withClose",
                culturalValues: true,
                members: {
                    obsRows: "{vizLoader}.obsRows",
                    taxaById: "{vizLoader}.taxa.rowById",
                    selectedTaxonId: "{paneHandler}.selectedTaxonId"
                }
            }
        }
    }
});
