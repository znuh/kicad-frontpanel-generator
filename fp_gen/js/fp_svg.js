/* Copyright (c) 2026 Benedikt Heinz <zn000h AT gmail.com>
 * Licensed under MIT (https://github.com/znuh/kicad-frontpanel-generator/blob/main/LICENSE)
 */

let SVG_FP = function() {

    let constructor = function create(cfg, target_node) {

		/* Helper function to make any sort of SVG element and assign attributes from attr_map in one go. */
		function mk_elem(name, attr_map = {}) {
			const ne = document.createElementNS(SVG_NS, name);
			for (const [attr, val] of Object.entries(attr_map))
				ne.setAttribute(attr, val);
			return ne;
		}

		const layer_map = cfg.layer_map;

		this.layer_map  = layer_map;
		this.output_fmt = 'SVG';

		/* Keep a cache of nodes per source_layer so we can change the color
		 * of all affected nodes without redrawing everything. */
		const nodes_by_layer = {};

		/* Keep a cache of all text nodes so we can change text attributes later without redrawing everything. */
		const text_nodes = [];

		/* Make the SVG root element */
		const svg = mk_elem("svg");

		/* Make defs section for filters */
		const defs = mk_elem("defs");

		/* Function to create/replace a knockout filter for src_layer */
		function update_filter(src_layer) {
			const id = "knockout_" + src_layer;
			defs.querySelector(`[id="${id}"]`)?.remove(); // remove old filter if one exists

			const filter = mk_elem("filter", {
				"id" : id,
				"x" : "0", "y" : "0",
				"width" : "100%", "height" : "100%",
			});
			filter.appendChild(mk_elem("feFlood", {
				"flood-color"	: layer_map[src_layer],
				"result"		: "bg",
			}));
			filter.appendChild(mk_elem("feComposite", {
				"in"		: "bg",
				"in2"		: "SourceGraphic",
				"operator"	: "out",
			}));
			defs.appendChild(filter);
		}

		/* Walk through all source layers to initialize some stuff */
		for (const src_layer in layer_map) {
			nodes_by_layer[src_layer] = [];  // init nodes_by_layer cache
			update_filter(src_layer);        // create knockout filter
		}

		svg.appendChild(defs);

		/***************** Functions to create SVG elements ********************/

		/* Make a text node */
		function mk_text(se, color, src_layer) {
			/* Notes:
			 * - text + tspan needed for multiline text (broken atm)
			 * - let user choose font
			 * - missing: bold, italics, justify left bottom etc.
			 */
			const pos      = find_token(se, "at");
			const effects  = find_token(se, "effects");
			const font     = find_token(effects, "font");

			const scale    = cfg.scale_text ?? 1.5; // TESTING
			const raw_size = find_token(font, "size")[1];
			const size     = raw_size*scale;

			const bold     = find_token(font, "bold")?.[1] === "yes";
			const italic   = find_token(font, "italic")?.[1] === "yes";
			const knockout = find_token(se, "layer")[2] === "knockout";

			// TODO: rotate
			if(pos[3])
				return null;

			/* Getting the same alignment as in KiCad is difficult.
			 * (Due to various factors such as different fonts.)
			 * Maybe give the user control over some correction values
			 * such as x/y offset, font, etc.? */
			//pos[1]+=1.5;

			/* TODO: new multi-line approach:
			 * Use dominant-baseline based on KiCad justify attribute.
			 * Then adjust tspan dy of each line.
			 *
			 * Note: Do halign in 2nd pass with a transform based on bounding box
			 * instead of using the text-anchor?
			 * Issues with text-anchor:
			 * - uses actual glyphs instead of bounding box -> not great for knockout rect
			 * - issue with multi-line text: which one is the longest line after rendering?
			 */

			const te = mk_elem("text", {
				"x" : pos[1], "y" : pos[2],
				"font-size"			: size,
				"fill"				: color,
				"text-anchor"		: "middle", // KiCad default for horizontal alignment

				// TBD: vertical alignment
				/* dominant-baseline only applies to the first tspan apparently,
				 * not the whole text block. So manual adjustment is needed */
				//"dominant-baseline" : "text-top", // candidate
				/////"dominant-baseline" : "hanging", // not suitable?
				"dominant-baseline" : "central", // not suitable?
				//"dominant-baseline" : "middle",
				//"dominant-baseline" : "alphabetic", // candidate
			});

			if(knockout) {
				te.removeAttribute("fill");
				te.setAttribute("filter", `url(#knockout_${src_layer})`);
			}

			if (bold)
				te.setAttribute("font-weight", "bold");
			if (italic)
				te.setAttribute("font-style", "italic");

			/* Text examples:
			 *  fp_text value 20k
			 *  fp_text user "foobar"
			 *  gr_text bot
			 *  gr_text "AP3513E"
			 * => use se[2] for fp_text, se[1] otherwise
			 * => pass through JSON.parse if first char is a double quote */
			let actual_text = ((se[0] === "fp_text") ? se[2] : se[1]);
			if (actual_text.charAt(0) === "\"")
				actual_text = JSON.parse(actual_text);

			const lines = actual_text.split("\n");
			for(i=0;i<lines.length;i++) {
				const ts = mk_elem("tspan", {
					"x" : pos[1], "dy" : size*(i>0),
				});
				ts.textContent = lines[i];
				te.appendChild(ts);
			}

			/* Do vertical alignment based on number of lines.
			 * KiCad default valign : center */
			let y_ofs = 0; //lines.length * size / 2;

			/* KiCad default justification is h center, v center */
			const justify = find_token(effects, "justify");
			if (justify) {
				for(i=1;i<justify.length;i++) {
					const just = justify[i];
					switch(just) {
						case "left":
							// restore SVG default: text-anchor = start
							te.removeAttribute("text-anchor");
							break;
						case "right":
							te.setAttribute("text-anchor", "end");
							break;
						case "bottom":
							//y_ofs = lines.length * size;
							te.setAttribute("dominant-baseline", "alphabetic");
							break;
						case "top":
							//y_ofs = lines.length * size / 4;
							te.setAttribute("dominant-baseline", "hanging");
							break;
						case "mirror":
							/* this works but needs tidying up.
							 * TODO: set x,y of te to zero and do only one transform */
							te.setAttribute("transform", `translate(${pos[1]}, ${pos[2]-y_ofs}) scale(-1, 1) translate(${-pos[1]}, ${-(pos[2]-y_ofs)})`);
							break;
						default:
							console.log("justify", just);
					}
				}
			}
			//te.setAttribute("y", pos[2]-y_ofs);

			text_nodes.push(te); // add to list of text nodes
			return te;
		}

		/* Call this after changing text attributes to update all text nodes. */
		this.update_texts = function(list = text_nodes) {
			list.forEach((n) => {
				// TBD
				//console.log(n.getBBox());
			});

			// set default font
			svg.setAttribute(
				"font-family",
				cfg.font ?? "Arial, Helvetica, sans-serif"
			);

			/* viewBox must be recalculated after text attributes changed */
			const bbox = svg.getBBox();
			const padding = cfg.padding ?? 5;
			svg.setAttribute(
				"viewBox",
				`${bbox.x - padding} ${bbox.y - padding} ${bbox.width + padding * 2} ${bbox.height + padding * 2}`
			);
		}

		/* Helper function for deriving SVG arc parameters from KiCad arcs */
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

			/* SVG needs a "large arc" flag for arcs >180°
			 * Input data from KiCad:
			 *   [x1,y1]: arc start
			 *   [x2,y2]: arc midpoint
			 *   [x3,y3]: arc end
			 * So the chord is the line between [x1,y1] and [x3,y3].
			 * We can now check, whether the mid point of the arc [x2,y2] is
			 * on the same side of the chord as the circumcenter [cx,cy].
			 * If mid and circumcenter are on the same side of the chord,
			 * it's a large (major) arc >180°. Otherwise it's a minor (non-large) arc.
			 *
			 * With [x1,y1] as the referenct point, cp_mid is the cross product
			 * between the chord vector and the vector to the mid point.
			 * The sign of cp_mid tells us, whether mid can be found on the "left" or
			 * "right" side of the chord. */
			const v_ac_x = x3-x1, v_ac_y = y3-y1;
			const cp_mid = v_ac_x * (y2-y1) - v_ac_y * (x2-x1);

			/* cp_center is the cross product between the chord vector and the vector
			 * to the circumcenter. */
			const cp_center = v_ac_x * (cy-y1) - v_ac_y * (cx-x1);

			/* Signs of cp_mid and cp_center can be compared by multiplying them.
			 * Same sign      : Positive result -> large arc
			 * Different signs: Negative result ->  smol arc */
			const large_arc = ((cp_mid * cp_center) > 0) ? 1 : 0;

			/* Sweep direction can be determined based on normalized angular difference of mid_ vs. start_angle according to Gemini.
			 * However, KiCad always seems to store arcs clockwise (-> sweep_dir = 1)?
			 * So I'm not adding the extra complexity until I find a counterexample and deem it necessary. */
			const sweep_dir = 1;

			return {r : r, la : large_arc, sd : sweep_dir}
		}

		/* Conversion functions for all relevant KiCad gr_/fp_* elements.
		 * Conversion function:
		 *   arg1: source element
		 *   arg2: color for newly generated node
		 *   returns generated node */
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
				const start  = find_token(se, "start");
				const end    = find_token(se, "end");
				const radius = find_token(se, "radius");
				const rect = mk_elem("rect", {
					"x" : start[1], "y" : start[2],
					"width"  : end[1]-start[1],
					"height" : end[2]-start[2],
					"fill"   : "none"
				});
				if (radius)
					rect.setAttribute("rx",radius[1]);
				return rect;
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

			/* Text is more complicated - let's give it a "real" function. */
			text : (se, color, src_layer) => mk_text(se, color, src_layer),
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

			const elem = conv(src, color, src_layer);
			if(!elem) {
				console.log("no elem!", gr, color, conv);
				return;
			}

			/* stroke style - set only if stroke definition exists
			 * (not applicable for text) */
			const stroke_width = find_token(src, "stroke", "width")?.[1];
			if (stroke_width != undefined) {
				elem.setAttribute("stroke", color);
				elem.setAttribute("stroke-width", stroke_width);
			}

			/* fill? */
			const fill = find_token(src, "fill");
			if (fill != null && fill[1] === "yes") {
				elem.setAttribute("fill", color);
				elem.setAttribute("fill-opacity", "0.5"); // TBD: only for PCB preview?
			}

			/* add to nodes_by_layer */
			nodes_by_layer[src_layer].push(elem);

			/* add to parent node */
			dst.appendChild(elem);
		}

		/* Convert & add a gr_ element */
		this.add_gr = (src) => gr_conv(svg, src);

		/* Convert & add a footprint */
		this.add_footprint = function(src) {
			const pos = find_token(src, "at");
			let transform = `translate(${pos[1]} ${pos[2]})`;
			if (pos[3])
				transform += ` rotate(${-pos[3]})`;

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
			/* Put the SVG into the DOM so getBBox returns valid values */
			target_node.replaceChildren(svg);

			/* Update all texts now that getBBox works */
			this.update_texts();

			return svg;
		}

		/* Call this after changing a layer mapping in cfg.layer_map
		 * to update the colors of the affected elements. */
		this.update_layer = function(layer) {
			const new_color = layer_map[layer];

			// update the knockout filter to new color
			update_filter(layer);

			nodes_by_layer[layer].forEach((e) => {
				// change fill - if set
				const old_fill = e.getAttribute("fill");
				if (old_fill && old_fill !== "none")
					e.setAttribute("fill", new_color);

				// change stroke - if set
				if(e.getAttribute("stroke"))
					e.setAttribute("stroke", new_color);
			});
		}

	}; /* constructor */

    return constructor;
}();
