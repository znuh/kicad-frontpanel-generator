# KiCad Frontpanel Generator

KiCad Frontpanel Generator creates matching front panels for KiCad PCBs automatically. The PCB designer defines cut-outs and labels in unused layers of footprints and in the PCB. The Front Panel Generator then uses the shapes from these layers to generate a suitable cover plate.

## Why a web app instead of a KiCad Plugin?
When I made the initial prototype in 2025, the old plugin API was ~~dying~~ deprecated and the new API still struggling to be born. Creating a derivative of a PCB without replacing/overwriting the original PCB was not possible. I already had a KiCad PCB parser in JS from [another project](https://github.com/znuh/kicad-chm36), so I decided to build upon this. Also, this should make SVG output (laser-cut frontpanels!) easier.

## Status
**Warning:** This is work in progress. At the moment this is my initial prototype. There is no proper UI or documentation yet.  
You have to read the source if you want to try it out at this stage.

## Example
![result_small](https://github.com/user-attachments/assets/cb5003e6-36cb-4a9b-92ae-091030bf9ce7)


## Funding

This project is funded through [NGI0 Commons Fund](https://nlnet.nl/commonsfund), a fund established by [NLnet](https://nlnet.nl) with financial support from the European Commission's [Next Generation Internet](https://ngi.eu) program. Learn more at the [NLnet project page](https://nlnet.nl/project/Frontpanel-Generator).

[<img src="https://nlnet.nl/logo/banner.png" alt="NLnet foundation logo" width="20%" />](https://nlnet.nl)
[<img src="https://nlnet.nl/image/logos/NGI0_tag.svg" alt="NGI Zero Logo" width="20%" />](https://nlnet.nl/commonsfund) 
