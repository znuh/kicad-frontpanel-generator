/* Copyright (c) 2026 Benedikt Heinz <zn000h AT gmail.com>
 * Licensed under MIT (https://github.com/znuh/kicad-frontpanel-generator/blob/main/LICENSE)
 */

let Kicad_FP = function() {

    let constructor = function create(cfg, fp_template) {
		const fp_pcb   = structuredClone(fp_template);	/* make a copy of empty PCB template */

		const layer_map = cfg.layer_map;

		this.layer_map  = layer_map;
		this.output_fmt = 'kicad_pcb';

		/* convert a graphics element for frontpanel
		 * (can be either gr_* or fp_*) */
		function gr_conv(src) {
			let src_layer_tok = find_token(src, "layer");
			let src_layer = JSON.parse(src_layer_tok?.[1] ?? '""');
			let dst_layers = layer_map[src_layer] ?? [];
			let res = [];

			/* copy & replace layer - create as many copies as target layers
			 * (one input element can create multiple output elements (e.g. gr_text/etc. in Cu+Mask)) */
			for (dst_layer of dst_layers) {
				let clone = structuredClone(src);
				let layer_tok = find_token(clone, "layer");
				layer_tok[1] = '"' + dst_layer + '"';
				res.push(clone);
			}
			return res;
		}

		/* Convert & add a gr_ element */
		this.add_gr = function(src) {
			fp_pcb.push(...gr_conv(src));
		}

		/* Convert & add a footprint */
		this.add_footprint = function(src) {

			/* footprint tokens we do not want to copy to the frontpanel */
			const footprint_ignore = {
				descr : true, tags : true, property : true, pad : true
			}

			const new_name = src[1].replace(/\w+?:/,'frontpanel:');		/* replace library name with 'frontpanel' */
			let res = ["footprint", new_name];							/* create footprint token */

			/* walk through remaining elements */
			for (let i=2; i<src.length; i++) {
				const se = src[i];

				/* pass graphic elements on to gr_conv */
				if (se[0].startsWith("fp_"))
					res.push(...gr_conv(se));

				/* deal with 3D model */
				else if (se[0] == "model") {
					if (config.kicad_output.keep_3d_models) {
						let model = structuredClone(se);
						let ofs = find_token(model, "offset", "xyz");
						for(let j=0; j<3; j++)
							ofs[j+1] += config.kicad_output.models_offset_adjust[j];
						res.push(model);
					}
				}

				/* copy non-ignored sub-elements */
				else if (!footprint_ignore[se[0]])
					res.push(structuredClone(se));
			}

			fp_pcb.push(res); // add converted footprint
		}

		this.finalize = function() {
			return fp_pcb;
		}

	}; /* constructor */

    return constructor;
}();
