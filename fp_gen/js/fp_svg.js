/* Copyright (c) 2026 Benedikt Heinz <zn000h AT gmail.com>
 * Licensed under MIT (https://github.com/znuh/kicad-frontpanel-generator/blob/main/LICENSE)
 */

let SVG_FP = function() {

    let constructor = function create(cfg) {

		const layer_map = kicad_layer_colors; // TEST

		this.layer_map  = layer_map;
		this.output_fmt = 'SVG';

		const svg = document.createElementNS(SVG_NS, "svg");

		function test(target, x, y) {
			const circle = document.createElementNS(SVG_NS, "circle");
			circle.setAttribute("cx", x);
			circle.setAttribute("cy", y);
			circle.setAttribute("r", "20");
			circle.setAttribute("fill", "pink")
			target.appendChild(circle);
		}

		/* TEST */
		test(svg, 20, 20);
		test(svg, -100, -100);
		test(svg, 100, 100);

		/* Convert & add a gr_ element */
		this.add_gr = function(src) {
			console.log("add_gr");
		}

		/* Convert & add a footprint */
		this.add_footprint = function(src) {
			console.log("add_fp");
		}

		this.finalize = function() {
			return svg;
		}

	}; /* constructor */

    return constructor;
}();
