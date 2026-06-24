# Átl’ka7tsem/Howe Sound Biosphere Vegetation Analysis

This project hosts a structure for building out and publishing a map-based storymapping
interface for the [Átl’ka7tsem/Howe Sound Biosphere Reserve](https://en.unesco.org/biosphere/eu-na/atlka7tsem_howe-sound)
based on [R Markdown](https://rmarkdown.rstudio.com/).

You can browse the published output of this project in these documents:

* [Sample Raw Knitted Output from R Markdown](https://imerss.github.io/howe-sound-mapping-2026/story/Protected.html)
* [Raw Output Reknitted into Storymapping Interface](https://imerss.github.io/howe-sound-mapping-2026/story/#)

The project's publishing pipeline is based on the [bioReportR](https://IMERSS/bioreportr) publishing system, which
is based on R and R Markdown, using free tools such as git, R and R studio, and published and hosted for free using
[GitHub Pages](https://pages.github.com/). BioReportR is based on the [blogdown](https://pkg.yihui.org/blogdown/)
R package for publishing web sites using the popular [hugo](https://gohugo.io/) framework.

These files were distilled from work done for the
[Maxwell Creek Watershed Project](https://transitionsaltspring.com/maxwell-creek-watershed-project/) which is being
undertaken by [Transition Salt Spring](https://transitionsaltspring.com/).

To see the potential of storymapping frameworks to use data to tell stories, you can visit two
thoroughly elaborated [data explorations](https://www.data-arc.org/my-front-page/example-data-explorations/) from
the dataARC project which present two stories, "Quantifying an ever-changing landscape" and "Data mining the past"
using two mature storymapping frameworks, [ESRI/ArcGIS Storymaps](https://storymaps.arcgis.com/) and [HTML + Binder/Jupyter](https://mybinder.org/).

Here we operate a homegrown approach showing how readily available and widely understood open source tools can be
orchestrated to produce a basic end-to-end authoring and hosting environment.
Consult [Knitting Data Communities](https://lichen-community-systems/knitting-data-communities/) for some values
underlying this work.

## Installation instructions

If you haven't worked with this kind of project before, you will need the following tools:

* git for your platform, installed according to instructions like [these ones from GitHub](https://github.com/git-guides/install-git).

* R and R studio, installed from [posit's website](https://posit.co/download/rstudio-desktop/)

In order to reknit the markup rendered by R and R markdown for the full website build, you will also need the following tools:

* node and npm for your platform, installed according to [node's instructions](https://nodejs.org/en/download/).

Rather than doing this yourself, you could enlist a friendly developer to do these actions for you and commit to
your repository. Before long, this repository will contain automatic actions to do this using
[GitHub Actions](https://github.com/features/actions).

## Starting your own work based on this repository

To make your own fork of this repository to start filling it with your own content, follow GitHub's instructions on
[forking a repository](https://docs.github.com/en/get-started/quickstart/fork-a-repo#forking-a-repository) - you will want
to choose a new name for the repository as shown in step 4 of these instructions.

For a more simple-minded approach, you can simply copy all the files resulting from cloning this repository into a new
folder on your system (missing out the `.git` directory).

After this, you can switch to Posit's instructions on
[using git with R Studio](https://support.posit.co/hc/en-us/articles/200532077-Version-Control-with-Git-and-SVN) - go to
the section named "Creating a new project based on a remote Git or Subversion repository" and supply the repository URL
for your forked repository at step 4. If you haven't worked with these tools before, you will want to choose the HTTPS
version of the repository URL available from the "Code" dropdown as shown in the following picture:

![Code in GitHub](img/code_img.png)

Another useful guide is at [Connect RStudio to Git and GitHub](https://happygitwithr.com/rstudio-git-github.html).

Before building and publishing the site, you will now need to download JavaScript dependencies for this project by opening
a terminal in its root folder and typing

    npm install

Blogdown and Hugo are installed automatically by the R platform, but Hugo's [hugo.yaml](hugo.yaml) file is the
root source of configuration for the published website which you should become familiar with. 
Here's [Hugo's guide](https://gohugo.io/configuration/introduction/) to this file.


## Knitting and reknitting markup from your markdown

The first part of the publishing chain is to use the builtin "knitting" functionality in R studio described in the
[authoring guide](https://rmarkdown.rstudio.com/authoring_quick_tour.html) - open up one of the .Rmd file
in the [story](content/story) directory and press the "Knit" button above it. This will produce an HTML file in ths same directory which can be
previewed to see if your maps, content and any widgets look as expected in a standalone mode.

As you edit your documents in [content/story](content/story),
you can build out scripts for further maps in [scripts](scripts), vector data as SHP files in
[spatial_data/vectors](spatial_data/vectors) and raster data in [spatial_data/rasters](spatial_data/rasters).
Please consult the [using Mapbox Layers in R](https://plotly.com/r/mapbox-layers/) guide for how to add your own map data
to your maps.

For examples of the kinds of vignettes you can build, you can consult:

[Vascular_BEC.Rmd](https://github.com/IMERSS/howe-sound-mapping-2026/blob/main/content/story/Vascular_BEC.Rmd) which
you can see live at [Vascular_BEC](https://imerss.github.io/howe-sound-mapping-2026/story/#pane:Vascular_BEC) --- a standard
vignette showing highlightable regions, a searchable taxonomy and pane of observations.

[Status.Rmd](https://github.com/IMERSS/howe-sound-mapping-2026/blob/main/content/story/Status.Rmd) which you
can see live at [Community Science](https://imerss.github.io/howe-sound-mapping-2026/story/#pane:Status) --- a gridded
choropleth which can be filtered by taxon status.

[Solow.Rmd](https://github.com/IMERSS/howe-sound-mapping-2026/blob/main/content/story/Solow.Rmd) which you can see
live at [Extirpation Risk](https://imerss.github.io/howe-sound-mapping-2026/story/#pane:Solow) --- a special vignette
allowing taxa to be ranked by extinction risk and showing communities agglomerated to a particular population radius.

The type of vignette is customised by a mixture of YAML front matter in the .Rmd files, and entries in the 
[config.json5](config.json5) file's `paneHandlers` section --- we are gradually migrating from the former to the latter.
Currently you must have an entry in `paneHandlers` matching the basename of the .Rmd file for each vignette.

Once your vignette knits properly using the R Studio "Knit" process, you can reknit them all into the story format, and build
the hugo/blogdown site as a whole by running
"Build Website" from R Studio's "Build" menu.
Commit and push the output from this stage using R Studio or command-line git as you prefer. For using R Studio
to commit your file, you can follow the steps in 
[section 12.4](https://happygitwithr.com/rstudio-git-github.html#make-local-changes-save-commit) of the guide to using
GitHub in R studio.

If you want to reknit to different input or output filenames, edit the reknitJobs block in the configuration file
at [config.json5](config.json5). To customise the markup which frames the reknitted output, you can edit the HTML
template at [src/html/template.html](src/html/template.html).

## Setting up GitHub Pages to publish your markup

To publish the markup resulting from both the knitting and the reknitting process, set up the configuration on your
repository to publish GitHub Pages from the `docs` folder of the `main` branch. This is available from the `Pages`
tab on your repository's settings, as shown in the image below:

![GitHub Pages configuration](img/gh-pages.png)

You can find our what URL your markup will be published at by looking in the GitHub Pages settings for your repository.

The overall URL of your documents published in GitHub pages will start with `https://<your-account>.github.io/<your-repository>`.

## Bringing your own data

The vizualisation requires three CSV files to be configured, which you can see in the `vizLoader` section of
[config.json5](config.json5). These are:

`obsFile` holding the catalogue of observations. For this visualisation, this file is
[AHSBR_Tracheophyta_ultimate-catalogue_2026-06-16-selected-labels.csv](docs/data/tabular/AHSBR_Tracheophyta_ultimate-catalogue_2026-06-16-selected-labels.csv).

`taxaFile` holding the aligned checklist/summary, together with entries for its higher taxa. For this visualisation, this file is
[AHSBR_Tracheophyta_ultimate-merged-summary_2026-06-16-prepared-taxa.csv](docs/data/tabular/AHSBR_Tracheophyta_ultimate-merged-summary_2026-06-16-prepared-taxa.csv).

`regionIndirectionFile` holding a condensed representation of regions which `obsFile` has been intersected with. This file
can be empty if you are not rendering any regions. If you would like to populate it, you can fill out a shapefile index
such as [Howe Shapefile Index.csv](tabular_data/Howe Shapefile Index.csv) mapping a set of SHP files and the relevant 
field names, and supply it to [intersectShapes.R](scripts/intersectShapes.R) to intersect these with your catalogue.

`obsFile` and `taxaFile` are prepared using the scripts [prepare_summary.R](scripts/prepare_summary.R),
[prepare_summary_final.R](scripts/prepare_summary_final.R) and [prepareObs.R](scripts/prepareObs.R),
accepting data from an upstream data processing pipeline
in [checklist-catalogue-alignment-workflow](https://github.com/emench/checklist-catalogue-alignment-workflow) which you
can adapt to your purposes. 

`taxaFile` and `obsFile` particularly can contain arbitrary extra columns you want rendered in the interface, but
need to have a core set of aligned fields.

`obsFile` must have a column `linkTaxonId` (aliased to `iNaturalistTaxonId`) which aligns observation rows with the 
column of the same name in `taxaFile`. In addition it should have columns `decimalLatitude`, `decimalLongitude` holding
the WGS84 coordinates of the observation as well as `eventDate` in an ISO8601 format.

The format of `taxaFile` is more constrained, and it may be helpful to apply the 
[assignBNames](https://github.com/IMERSS/imerss-bioinfo/blob/main/src/assignBNames.js) JavaScript data preparation script
to compute some of the columns with reference to iNaturalist's API.

Required fields in `taxaFile`:

| Column                                    | Type    | Description                                                                                                                 |
|-------------------------------------------|---------|-----------------------------------------------------------------------------------------------------------------------------|
| `id`                                      | integer | Unique taxon ID. Primary key.                                                                                               |
| `parentId`                                | integer | `id` of this taxon's parent in the hierarchy                                                                                |
| `linkTaxonName` / `iNaturalistTaxonName`  | string  | The taxon's name as recorded in link database, typically iNaturalist                                                        |
| `commonName`                              | string  | Vernacular / common name.                                                                                                   |
| `rank`                                    | string  | Taxonomic rank: `stateofmatter`, `kingdom`, `phylum`, `subphylum`, `class`, `order`, `family`, etc.                         |
| `linkTaxonImage`/ `iNaturalistTaxonImage` | URL     | Link to a representative photo (medium size) for the taxon.                                                                 |
| `scientificName`                          | string  | Scientific name - project's official name for taxon                                                                         |
| `inSummary`                               | integer | 1/0 Flag for whether the taxon is included in a summary view / output. If not set, this represents a higher classification. |

Sample optional taxon fields:

| Column                                    | Type | Description                                                                                   |
|-------------------------------------------|---|-----------------------------------------------------------------------------------------------|
| `introduction_status`                     | string | Whether the taxon is introduced vs. native.                                                  |
| `reportingStatus`                         | string | Reporting / record status for the list, e.g. confirmed, historical, new                      |
| `infrataxon_status`                       | string | Status relating to infraspecific taxa (subspecies / varieties). |
| `provincial_concern`                      | string | Provincial conservation-concern designation.                     |
| `provenance_status`                       | string | Provenance — e.g. native vs. non-native origin.                  |
| `solow_EP`                                | numeric | Solow extinction-probability value                                                            |
| `species`                                 | string | Species epithet / name component.                                                            |
| `subspecies`                              | string | Subspecies name component, if any.                                                            |
| `variety`                                 | string | Variety name component, if any.                                                               |


## Get involved

To suggest improvements to these instructions and publishing system, please
[raise an issue](https://github.com/IMERSS/bioreportr/issues). For a wider background
surrounding this project and its philosophy, please go to
[Knitting Data Communities](https://lichen-community-systems/knitting-data-communities/) or 
[IMERSS](https://imerss.org/).
