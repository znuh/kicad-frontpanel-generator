/* Copyright (c) 2026 Benedikt Heinz <zn000h AT gmail.com>
 * Licensed under MIT (https://github.com/znuh/kicad-frontpanel-generator/blob/main/LICENSE)
 */

let SVG_FP = function() {

    let constructor = function create(cfg) {

		/* test */
		const layer_map = {
			'User.1'	:	"blue",
			'User.2'	:	"red",
			'User.3'	:	"green",
			'User.4'	:	"black",
		};

		this.layer_map  = layer_map;
		this.output_fmt = 'SVG';

		const SVG_NS = "http://www.w3.org/2000/svg";
		const svg = document.createElementNS(SVG_NS, "svg");
		const rootg = document.createElementNS(SVG_NS, "g");
		svg.appendChild(rootg);

		/* TEST */
		const circle = document.createElementNS(SVG_NS, "circle");
		circle.setAttribute("cx", "50");
		circle.setAttribute("cy", "50");
		circle.setAttribute("r", "20");
		circle.setAttribute("fill", "pink")
		rootg.appendChild(circle);

		/* Convert & add a gr_ element */
		this.add_gr = function(src) {
			console.log("add_gr");
		}

		/* Convert & add a footprint */
		this.add_footprint = function(src) {
			console.log("add_fp");
		}

		this.finalize = function() {
			/*
			const bbox = rootg.getBBox();
			const padding = 16;
			svg.setAttribute(
				"viewBox",
				`${bbox.x - padding} ${bbox.y - padding} ${bbox.width + padding * 2} ${bbox.height + padding * 2}`
			);
			*/
			return svg;
		}

	}; /* constructor */

    return constructor;
}();
