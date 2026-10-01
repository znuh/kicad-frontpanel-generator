/* Copyright (c) 2026 Benedikt Heinz <zn000h AT gmail.com>
 * Licensed under MIT (https://github.com/znuh/kicad-frontpanel-generator/blob/main/LICENSE)
 */

/* There are two SVG use-cases:
 *
 * 1) SVG for a laser-cut frontpanel - this is the straightforward case.
 *    Every input layer is translated to a different output color.
 *    The different output colors are used to identify the cutting order
 *    and distinguish between cutting and engraving.
 *
 *    Preview and exported SVG are exactly the same.
 *    Exported SVG always has a transparent background, while
 *    the preview can have a solid background color. However, this
 *    background color is applied through the underlying HTML div
 *    instead of drawing the background in the SVG itself.
 *
 * 2) SVG as PCB frontpanel preview - this is more complicated.
 *    The SVG should resemble the actual PCB as close as possible.
 *    This means we need to draw the layers in the correct order:
 *    - FR-4 base material
 *    - F.Cu (front copper)
 *    - F.Mask (front solermask - negative mask!)
 *    - F.SilkS (front silkscreen)
 *    Figuring out the overall PCB shape is non-trivial because there
 *    is no continuous path in Edge.Cuts defining the shape.
 *    So intead we just reproduce the Edge.Cuts paths as an extra layer.
 */

/* TBD:
 * - PCB preview mode: fix text y position
 * - Text: make knockout effect work again
 * - Document cfg (config) options
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

		/* One group per layer */
		const layer_groups = {};

		/* Keep a cache of all text nodes so we can change text attributes later without redrawing everything. */
		const text_nodes = [];

		/* Make the SVG root element */
		const svg = mk_elem("svg");

		/* Make defs section for filters */
		const defs = mk_elem("defs");

		/* Create a base rectangle for the full extents of the PCB
		 * we will adjust x, y, width and height later on and invoke
		 * it for the background and masks. */
		const extents_rect = mk_elem("rect", {id : 'extents_rect'});
		defs.appendChild(extents_rect);

		/* Function to create/replace a knockout filter for src_layer
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
		*/

		svg.appendChild(defs);

		/* 1st layer in body: Background - optional*/
		if (cfg.background) {
			svg.appendChild(mk_elem("use", {
				'xlink:href' : "#extents_rect",
				href : "#extents_rect",
				fill : cfg.background,
			}));
		}

		/* PCB preview mode if F.Cu or F.Mask layer found in layer_map */
		const PCB_preview_mode = !!(layer_map['F.Cu'] || layer_map['F.Mask']);
		if (PCB_preview_mode) {

			/* Create F.Cu group which holds the actual F.Cu data */
			let g = mk_elem("g", {id : 'F.Cu'});
			layer_groups['F.Cu'] = g;
			defs.appendChild(g);

			/* Create initial/base F.Mask group which holds the *negative* actual F.Mask data */
			g = mk_elem("g", {id : 'F.Mask'});
			layer_groups['F.Mask'] = g;
			defs.appendChild(g);

			/* Create F.Mask_mask which creates the *positive* SVG mask for F.Mask */
			g = mk_elem("mask", {id : 'F.Mask_mask'});
			/* Add inversion rect to the mask */
			g.appendChild(mk_elem("use", {
				'xlink:href' : "#extents_rect",
				href : "#extents_rect",
				fill : "#ffffff",
			}));
			/* Add F.Mask to the mask */
			g.appendChild(mk_elem("use", {
				'xlink:href' : '#F.Mask',
				href   : '#F.Mask',
				fill   : "#000000",
				stroke : "#000000",
			}));
			layer_groups['F.Mask_mask'] = g;
			defs.appendChild(g);

			/* Create F.Mask_finish which creates a *negative* SVG mask for F.Mask.
			 * This is used to apply the surface finish by masking F.Cu
			 * with the original negative F.Mask. */
			g = mk_elem("mask", {id : 'F.Mask_finish'});
			/* Clear mask initially */
			g.appendChild(mk_elem("use", {
				'xlink:href' : "#extents_rect",
				href : "#extents_rect",
				fill : "#000000",
			}));
			/* Add openings from F.Mask */
			g.appendChild(mk_elem("use", {
				'xlink:href' : '#F.Mask',
				href   : '#F.Mask',
				fill   : "#ffffff",
				stroke : "#ffffff",
			}));
			layer_groups['F.Mask_finish'] = g;
			defs.appendChild(g);

			/* Now create the body F.Cu layer which invokes the defs F.Cu: F.Cu_bare */
			g = mk_elem("use", {
				'xlink:href' : '#F.Cu',
				href	: '#F.Cu',
				fill	: Cu_color,
				stroke	: Cu_color,
			});
			layer_groups['F.Cu_bare'] = g;
			svg.appendChild(g);

			/* Now create the body F.Mask layer: F.Mask_pour */
			const mask_color = layer_map['F.Mask'];
			const opacity    = mask_opacity[mask_color] ?? 0.85;
			g = mk_elem("use", {
				'xlink:href' : '#extents_rect',
				href: '#extents_rect',
				mask  : 'url(#F.Mask_mask)',
				fill   : mask_color,
				stroke : layer_map['F.Mask'],
				'fill-opacity'   : opacity,
				'stroke-opacity' : opacity,
			});
			layer_groups['F.Mask_pour'] = g;
			svg.appendChild(g);

			/* Finally the surface finish layer on the exposed copper */
			g = mk_elem("use", {
				'xlink:href' : '#F.Cu',
				href	: '#F.Cu',
				fill	: layer_map['F.Cu'],
				stroke	: layer_map['F.Cu'],
				mask  : 'url(#F.Mask_finish)',
			});
			layer_groups['F.Cu_finish'] = g;
			svg.appendChild(g);
		}

		/* Walk through all source layers to initialize some stuff */
		for (const [input_layer, color] of Object.entries(layer_map)) {

			/* In PCB preview mode we already created "special" layers
			 * for F.Cu & F.Mask, so we must skip creating them here. */
			const skip = !!layer_groups[input_layer];

			console.log(`${skip ? "skip" : "create"} layer group ${input_layer}`);
			if (skip)
				continue;

			//update_filter(input_layer);        // create knockout filter

			/* Make one group per input layer */
			const g = mk_elem("g", {
				fill				: color,
				stroke				: color,
				"stroke-linecap"	: "round",
			});
			if (cfg.fill_opacity)
				g.setAttribute("fill_opacity", cfg.fill_opacity);
			layer_groups[input_layer] = g;
			svg.appendChild(g);
		}

		/***************** Functions to create/process/update SVG elements ********************/

		/* Update SVG extents / viewport */
		function update_extents() {
			const padding = cfg.padding ?? 5;

			/* Exclude previous extents from extents ;-) */
			extents_rect.setAttribute("display", "none");

			const bbox = svg.getBBox();

			/* Update extents_rect and drop display=none again */
			extents_rect.setAttribute("x", bbox.x);
			extents_rect.setAttribute("y", bbox.y);
			extents_rect.setAttribute("width",  bbox.width);
			extents_rect.setAttribute("height", bbox.height);
			extents_rect.removeAttribute("display");

			// round everything to 1um
			const x = +(bbox.x - padding).toFixed(3), y = +(bbox.y - padding).toFixed(3);
			const w = +(bbox.width + padding * 2).toFixed(3), h = +(bbox.height + padding * 2).toFixed(3);
			svg.setAttribute("viewBox", `${x} ${y} ${w} ${h}`);
			svg.setAttribute("width", w+"mm");
			svg.setAttribute("height", h+"mm");
		}

		/* Make a text node */
		function mk_text(se, src_layer) {
			const pos      = find_token(se, "at");
			const effects  = find_token(se, "effects");
			const font     = find_token(effects, "font");
			const size     = find_token(font, "size")[1];
			const face     = find_token(font, "face")?.[1];
			const bold     = find_token(font, "bold")?.[1] === "yes";
			const italic   = find_token(font, "italic")?.[1] === "yes";
			const knockout = find_token(se, "layer")[2] === "knockout";
			let   mirror   = false;

			const te = mk_elem("text", {
				/* Initially we place all text at x,y = 0,0 so we can do rotation & mirroring easily.
				 * Then we use a transform w/ translate in update_texts() to move the text into place.
				 * font-size is also set in update_texts() */
				"text-anchor"		: "middle",  // KiCad default for horizontal alignment
				"dominant-baseline"	: "central", // KiCad default for vertical alignment
			});

			if(face)
				te.setAttribute("font-family", (face.charAt(0) === "\"") ? JSON.parse(face) : face);

			if(knockout) {
				// TBD
				/* Knockout effect is done with a filter */
				//te.removeAttribute("fill");
				//te.setAttribute("filter", `url(#knockout_${src_layer})`);
			}

			if (bold)
				te.setAttribute("font-weight", "bold");
			if (italic)
				te.setAttribute("font-style", "italic");

			/* Walk through text justifications */
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
							te.setAttribute("dominant-baseline", "alphabetic");
							break;
						case "top":
							te.setAttribute("dominant-baseline", "hanging");
							break;
						case "mirror":
							mirror = true;
							break;
						default:
							console.log("unknown justify:", just);
					}
				}
			}

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
			const tspans = [];
			for(i=0;i<lines.length;i++) {
				const ts = mk_elem("tspan", {"x":0});
				ts.textContent = lines[i];
				te.appendChild(ts);
				tspans.push(ts);
			}

			/* All the positioning/alignment, rotation and mirroring is done later
			 * by update_texts() when getBBox() returns valid values.
			 * Save all relevant text parameters here in text_nodes,
			 * so update_texts() can use them directly later. */
			text_nodes.push({
				pos     : pos, // [1]:x, [2]:y, [3]:rotation - if any
				size    : size,
				valign  : te.getAttribute("dominant-baseline"),
				//halign  : te.getAttribute("text-anchor"), // not needed by update_texts() atm
				mirror  : mirror,

				te      : te,     // text element
				tspans  : tspans, // tspan elements
			}); // add to list of text nodes
			return te;
		}

		/* Call this after changing text attributes to update all text nodes. */
		this.update_texts = function(list = text_nodes) {
			const scale = cfg.scale_text ?? 1.5;

			// update all text_nodes
			list.forEach((txt) => {
				const pos    = txt.pos;
				const size   = txt.size * scale;
				const te     = txt.te;
				const tspans = txt.tspans;
				let x = pos[1], y = pos[2];

				// set size first
				te.setAttribute("font-size", size);

				/* Now set dy on all tspans.
				 * The dominant-baseline SVG attribute only affects the position of the first tspan,
				 * not the whole text block. So we move the first tspan if necessary (when valign == central).
				 * All remaining tspans are positioned relative to the previous one. */
				let dy = (txt.valign === "central") ? -((tspans.length-1)*size/2) : 0;
				tspans.forEach((ts, i) => {
					ts.setAttribute("dy", dy);
					dy = size; // switch to regular font size stepping after first tspan
				});

				// adjust y based on valign and bounding box
				if (txt.valign === "alphabetic") {
					const bbox = te.getBBox();
					// TBD: this seems so go wrong in PCB_preview_mode - but why?
					if (!PCB_preview_mode)
						y-=bbox.height-size;
				}

				let transform = `translate(${x}, ${y})`;
				if (pos[3])
					transform += ` rotate(${-pos[3]})`;
				if (txt.mirror)
					transform += " scale(-1, 1)";
				te.setAttribute("transform", transform);
			});

			// set default font
			svg.setAttribute(
				"font-family",
				cfg.font ?? "Arial, Helvetica, sans-serif"
			);

			/* viewBox must be recalculated after text attributes changed */
			update_extents();
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
		 *   arg2: source layer
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
				});
			},

			arc : (se) => {
				const start = find_token(se, "start");
				const mid   = find_token(se, "mid");
				const end   = find_token(se, "end");
				const arc	= arc_params(start[1], start[2], mid[1], mid[2], end[1], end[2]);
				return mk_elem("path", {
					"d" : `M ${start[1]},${start[2]} A ${arc.r},${arc.r} 0 ${arc.la},${arc.sd} ${end[1]},${end[2]}`,
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
				});
			},

			/* Text is more complicated - let's give it a "real" function. */
			text : (se, src_layer) => mk_text(se, src_layer),
		};

		/* gi: group_info holding info & per-layer groups for footprints */
		function get_group(src_layer, gi) {
			//console.log(src_layer, gi);
			if (gi && layer_groups[src_layer]) {
				let g = gi.groups[src_layer];
				if (!g) {
					g = mk_elem("g", {"transform" : gi.transform});
					gi.groups[src_layer] = g;
					layer_groups[src_layer].appendChild(g);
				}
				return g;
			}
			else
				return layer_groups[src_layer];
		}

		/* Convert a graphics element for frontpanel (can be either gr_* or fp_*)
		 * and add the new element to dst. */
		function gr_conv(src, group_info) {
			let src_layer_tok = find_token(src, "layer");
			let src_layer = JSON.parse(src_layer_tok?.[1] ?? '""');
			const parent = get_group(src_layer, group_info);

			if (!parent)
				return;

			const gr   = src[0].substring(3);
			const conv = gr_map[gr];

			if(!conv) {
				console.log("no conv!", gr, conv);
				return;
			}

			const elem = conv(src, src_layer);
			if(!elem) {
				console.log("no elem!", gr, conv);
				return;
			}

			/* stroke style - set only if stroke definition exists
			 * (not applicable for text) */
			const stroke_width = find_token(src, "stroke", "width")?.[1];
			if (stroke_width != undefined)
				elem.setAttribute("stroke-width", stroke_width);
			else
				elem.setAttribute("stroke", "none");

			/* fill? */
			const fill = find_token(src, "fill");
			if (gr !== 'text' && (!fill || fill[1] !== "yes"))
				elem.setAttribute("fill", "none");

			/* add to parent node */
			parent.appendChild(elem);
		}

		/* Convert & add a gr_ element */
		this.add_gr = (src) => gr_conv(src);

		/* Convert & add a footprint */
		this.add_footprint = function(src) {
			const pos = find_token(src, "at");
			let transform = `translate(${pos[1]} ${pos[2]})`;
			if (pos[3])
				transform += ` rotate(${-pos[3]})`;

			const grouping = {
				transform : transform,
				groups    : {}, // input layer -> group
			};

			/* walk through remaining elements */
			for (let i=2; i<src.length; i++) {
				const se = src[i];

				/* pass graphic elements on to gr_conv */
				if (se[0].startsWith("fp_"))
					gr_conv(se, grouping);
			} // foreach element of footprint

		} // this.add_footprint

		this.finalize = function() {
			/* Put the SVG into the DOM so getBBox returns valid values */
			target_node.replaceChildren(svg);

			/* Update all texts now that getBBox works.
			 * Also calls update_extents() */
			this.update_texts();

			return svg;
		} // this.finalize

		/* Call this after changing a layer mapping in cfg.layer_map
		 * to update the colors of the affected elements. */
		this.update_layer = function(layer) {
			const new_color = layer_map[layer];
			/* In PCB preview mode we must switch to different layer names
			 * when dealing with F.Mask or F.Cu */
			const redirects = {
				'F.Cu'   : 'F.Cu_finish',
				'F.Mask' : 'F.Mask_pour',
			};
			layer = redirects[layer] ?? layer;
			console.log("update_layer "+layer+" "+new_color);

			// update the knockout filter to new color
			//update_filter(layer);

			const g = layer_groups[layer];
			g.setAttribute("fill", new_color);
			g.setAttribute("stroke", new_color);

			if (PCB_preview_mode) {
				if (layer === 'F.Mask_pour') {
					const opacity = mask_opacity[new_color] ?? 0.85;
					g.setAttribute('fill-opacity',   opacity);
					g.setAttribute('stroke-opacity', opacity);
				}
			}
			else if (!cfg.fill_opacity)
				g.removeAttribute("fill-opacity");
			else
				g.setAttribute("fill-opacity", cfg.fill_opacity);
		} // this.update_layer

	}; /* constructor */

    return constructor;
}();
