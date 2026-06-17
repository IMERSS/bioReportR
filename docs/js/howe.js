"use strict";

// noinspection ES6ConvertVarToLetConst
var reknitr = fluid.registerNamespace("reknitr");

// Mixin grade to apply Weibull distribution scaling for gridded obs counts as per https://claude.ai/chat/3c2ca1c6-452f-47e8-b19e-5ce1045ef26f
fluid.defaults("reknitr.storyPage.withSaanichWeibull", {
    countTransform: (x, maxCount) =>        maxCount < 200 ? x : 1 - Math.exp(-Math.pow(x / 0.012, 0.5)),
    inverseCountTransform: (x, maxCount) => maxCount < 200 ? x : 0.012 * Math.pow(-Math.log(1 - x), 1 / 0.5),
    distributeOptions: {
        countTransform: {
            source: "{that}.options.countTransform",
            target: "{that hortis.libreMap.withObsGrid}.options.members.countTransform"
        },
        inverseCountTransform: {
            source: "{that}.options.inverseCountTransform",
            target: "{that hortis.libreMap.withObsGrid}.options.members.inverseCountTransform"
        }
    }
});

fluid.registerNamespace("reknitr.howeTaxaFiltersHolder");

reknitr.howeTaxaFiltersHolder.markup = `
<div class="mxcw-taxa-filters-holder">
    <div class="imerss-filter-controls">
        <svg width="24" height="24" class="imerss-reset-filter">
            <use href="#filter-reset" />
        </svg>
        <div>Reset filters</div>
    </div>
    <div class="imerss-filters imerss-taxa-filters">
    </div>
</div>`;


// Contains bits of "hortis.standardVizLoader" from imerss-viz.js in core
fluid.defaults("reknitr.howeTaxaFiltersHolder", {
    gradeNames: ["fluid.viewComponent", "fluid.containerRenderingView"],

    markup: {
        container: reknitr.howeTaxaFiltersHolder.markup
    },
    selectors: {
        filterControls: ".imerss-filter-controls",
        filters: ".imerss-taxa-filters"
    },
    components: {
        filterControls: {
            type: "hortis.filterControls",
            container: "{that}.dom.filterControls"
        },
        filters: {
            type: "reknitr.howeFilters",
            container: "{that}.dom.filters",
            options: {
                members: {
                    allInput: "@expand:fluid.computed(reknitr.summaryTaxaRows, {vizLoader}.taxa.rows)"
                }
            }
        }
    }
});


reknitr.howeFiltersTemplate = `
    <div class="imerss-filters">
        <div class="imerss-filter"></div>
        <div class="imerss-rank-filter imerss-filter"></div>
        <div class="imerss-introduction-filter imerss-filter"></div>
        <div class="imerss-provenance-filter imerss-filter"></div>
        <div class="imerss-conservation-filter imerss-filter"></div>
        <div class="imerss-graminoid-filter imerss-filter"></div>
    </div>
`;

fluid.defaults("reknitr.howeFilters", {
    gradeNames: ["hortis.taxaFilters", "fluid.stringTemplateRenderingView"],
    markup: {
        container: reknitr.howeFiltersTemplate,
        fallbackContainer: reknitr.howeFiltersTemplate
    },
    selectors: {
        rankFilter: ".imerss-rank-filter",
        introductionFilter: ".imerss-introduction-filter",
        provenanceFilter: ".imerss-provenance-filter",
        conservationFilter: ".imerss-conservation-filter",
        graminoidFilter: ".imerss-graminoid-filter"
    },
    components: {
        filterRoot: "{vizLoader}",
        rankFilter: {
            type: "hortis.valueFilter",
            container: "{that}.dom.rankFilter",
            options: {
                gradeNames: "hortis.taxaFilter",
                filterName: "Infrataxon Status",
                fieldName: "infrataxon_status",
                fieldValues: ["infrataxon", "non-infrataxon"]
            }
        },
        introductionFilter: {
            type: "hortis.valueFilter",
            container: "{that}.dom.introductionFilter",
            options: {
                gradeNames: "hortis.taxaFilter",
                filterName: "Introduction Status",
                fieldName: "introduction_status",
                fieldValues: ["native", "exotic", "unknown"]
            }
        },
        provenanceFilter: {
            type: "hortis.valueFilter",
            container: "{that}.dom.provenanceFilter",
            options: {
                gradeNames: "hortis.taxaFilter",
                filterName: "Provenance Status",
                fieldName: "provenance_status",
                fieldValues: ["voucher", "no_voucher", "unknown"],
            }
        },
        conservationFilter: {
            type: "hortis.valueFilter",
            container: "{that}.dom.conservationFilter",
            options: {
                gradeNames: "hortis.taxaFilter",
                filterName: "Conservation Status",
                fieldName: "provincial_concern",
                fieldValues: ["concern", "secure"],
            }
        },
        graminoidFilter: {
            type: "hortis.graminoidFilter",
            container: "{that}.dom.graminoidFilter"
        }
    }
});
