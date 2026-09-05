/* Copyright (c) 2026 Benedikt Heinz <zn000h AT gmail.com>
 * Licensed under MIT (https://github.com/znuh/kicad-frontpanel-generator/blob/main/LICENSE)
 */

let SVG_FP = function() {

    let constructor = function create(cfg) {

		const layer_map = kicad_layer_colors; // TEST

		this.layer_map  = layer_map;
		this.output_fmt = 'SVG';

		const svg = document.createElementNS(SVG_NS, "svg");

		/* make SVG element and assign attributes from attr_map */
		function mk_elem(name, attr_map = {}) {
			const ne = document.createElementNS(SVG_NS, name);
			for (const [attr, val] of Object.entries(attr_map))
				ne.setAttribute(attr, val);
			return ne;
		}

		function arc_params(x1,y1,x2,y2,x3,y3) {
			/* Note: The math formulae for deriving the necessary SVG arc parameters (radius & large_arc_flag) from the
			 * KiCad params (mid point instead of radius & large_arc_flag) were figured out with the help of Gemini Flash 3.6 Extended.
			 *
			 * This function wasn't generated directly by Gemini, but (parts of) the math formulae were produced by Gemini in Python
			 * and then manually examined/modified and adapted for use in JavaScript by a hooman who isn't a geometry nerd %-)
			 * Testing with all sorts of arcs (see tests/test_arc.kicad_pcb) was done to make sure the parameter conversion is robust.
			 *
			 * Prompt was:
			 *   I have the following KiCad arc definition: (start 55 38) (mid 55.8 35.8) (end 58 35).
			 *   How do I get the radius and determine if the arc is >180° for the large_arc_flag of SVG arcs?
			 */

			/* Find circumcenter first (https://en.wikipedia.org/wiki/Circumcircle#Cartesian_coordinates_2) */
			const d = 2 * (x1 * (y2-y3) + x2 * (y3-y1) + x3 * (y1-y2));
			const cx = ((x1**2 + y1**2) * (y2-y3) + (x2**2 + y2**2) * (y3-y1) + (x3**2 + y3**2) * (y1-y2)) / d;
			const cy = ((x1**2 + y1**2) * (x3-x2) + (x2**2 + y2**2) * (x1-x3) + (x3**2 + y3**2) * (x2-x1)) / d;

			/* Radius: Distance from start to center (Pythagoras) */
			const r = Math.hypot(x1-cx, y1-cy);

			/* Cross products needed to determine >180° arcs */
			const v_ac_x = x3-x1, v_ac_y = y3-y1;
			const cp_mid    = v_ac_x * (y2-y1) - v_ac_y * (x2-x1);
			const cp_center = v_ac_x * (cy-y1) - v_ac_y * (cx-x1);

			/* Large arc if >180° */
			const large_arc = ((cp_mid * cp_center) > 0) ? 1 : 0;

			/* Sweep direction can be determined based on normalized angular difference of mid_ vs. start_angle according to Gemini.
			 * However, KiCad always seems to store arcs clockwise (-> sweep_dir = 1)?
			 * So I'm not adding the extra complexity until I find a counterexample and deem it necessary. */
			const sweep_dir = 1;

			return {r : r, la : large_arc, sd : sweep_dir}
		}

		const gr_map = {

			line : (se) => {
				const start = find_token(se, "start");
				const end   = find_token(se, "end");
				return mk_elem("line", {
					"x1" : start[1], "y1" : start[2],
					"x2" : end[1],   "y2" : end[2]
				});
			},

			rect : (se) => {
				const start = find_token(se, "start");
				const end   = find_token(se, "end");
				return mk_elem("rect", {
					"x" : start[1], "y" : start[2],
					"width"  : end[1]-start[1],
					"height" : end[2]-start[2],
					"fill"   : "none"
				});
			},

			circle : (se) => {
				const center = find_token(se, "center");
				const end    = find_token(se, "end");
				return mk_elem("circle", {
					"cx" : center[1], "cy" : center[2],
					"r"    : Math.hypot(end[1]-center[1], end[2]-center[2]),
					"fill" : "none"
				});
			},

			arc : (se) => {
				const start = find_token(se, "start");
				const mid   = find_token(se, "mid");
				const end   = find_token(se, "end");
				const arc	= arc_params(start[1], start[2], mid[1], mid[2], end[1], end[2]);
				// TODO: arcs > 180° ?? large-arc-flag sweep-flag ??
				return mk_elem("path", {
					"d" : `M ${start[1]},${start[2]} A ${arc.r},${arc.r} 0 ${arc.la},${arc.sd} ${end[1]},${end[2]}`,
					"fill" : "none"
				});
			},

			poly : (se) => {
				const pin = find_token(se, "pts");
				let pout="";

				/* copy points from pin to pout */
				for (let i=1; i<pin.length; i++) {
					const pt = pin[i];
					console.assert(pt[0] === "xy");
					pout += " " + pt[1] + "," + pt[2];
				}
				return mk_elem("polygon", {
					"points" : pout.substring(1),
					"fill"   : "none"
				});
			},
		};

		/* Convert a graphics element for frontpanel (can be either gr_* or fp_*)
		 * and add the new element to dst. */
		function gr_conv(dst, src) {
			let src_layer_tok = find_token(src, "layer");
			let src_layer = JSON.parse(src_layer_tok?.[1] ?? '""');
			let color = layer_map[src_layer];

			if (color == undefined)
				return;

			const gr   = src[0].substring(3);
			const conv = gr_map[gr];

			if(!conv) {
				console.log("no conv!", gr, color, conv);
				return;
			}

			const elem = conv(src);
			if(!elem) {
				console.log("no elem!", gr, color, conv);
				return;
			}

			/* stroke style */
			elem.setAttribute("stroke", color);
			elem.setAttribute("stroke-width", find_token(src, "stroke", "width")[1]);

			/* fill? */
			const fill = find_token(src, "fill");
			if (fill != null && fill[1] === "yes") {
				elem.setAttribute("fill", color);
				elem.setAttribute("fill-opacity", "0.5"); // TBD: only for PCB preview?
			}

			dst.appendChild(elem);
		}

		/* Convert & add a gr_ element */
		this.add_gr = (src) => gr_conv(svg, src);

		/* Convert & add a footprint */
		this.add_footprint = function(src) {
			const pos = find_token(src, "at");
			let transform = `translate(${pos[1]} ${pos[2]})`;
			if (pos[3]) // TODO: verify rotate
				transform += ` rotate(${-pos[3]}) `;

			/* make a group */
			const fpg = mk_elem("g", {"transform" : transform});

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
