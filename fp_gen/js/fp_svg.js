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

		/* Convert a graphics element for frontpanel (can be either gr_* or fp_*)
		 * and add the new element to dst. */
		function gr_conv(dst, src) {
			let src_layer_tok = find_token(src, "layer");
			let src_layer = JSON.parse(src_layer_tok?.[1] ?? '""');
			let color = layer_map[src_layer];

			if (color === undefined)
				return;

			// TBD
			console.log(src[0], color);
			//dst.appendChild(ne);
		}

		/* Convert & add a gr_ element */
		this.add_gr = (src) => gr_conv(svg, src);

		/* Convert & add a footprint */
		this.add_footprint = function(src) {
			const fpg = document.createElementNS(SVG_NS, "g");
			const pos = find_token(src, "at");
//			console.log(pos);
			let transform="";
			if (pos[3]) // TODO: verify rotate
				transform = `rotate(${pos[3]}) `;
			transform += `translate(${pos[1]} ${pos[2]})`;
			fpg.setAttribute("transform", transform);

			/* walk through remaining elements */
			for (let i=2; i<src.length; i++) {
				const se = src[i];

				/* pass graphic elements on to gr_conv */
				if (se[0].startsWith("fp_"))
					gr_conv(fpg, se);

				//else console.log("fp element", se[0]);
			}

			svg.appendChild(fpg); // add converted footprint
		}

		this.finalize = function() {
			return svg;
		}

	}; /* constructor */

    return constructor;
}();
