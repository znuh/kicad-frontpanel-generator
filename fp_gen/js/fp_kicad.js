/* Copyright (c) 2026 Benedikt Heinz <zn000h AT gmail.com>
 * Licensed under MIT (https://github.com/znuh/kicad-frontpanel-generator/blob/main/LICENSE)
 */

let KicadFP = function() {

    let constructor = function create(cfg, fp_template) {
		const fp_pcb   = structuredClone(fp_template);	/* make a copy of empty PCB template */

		this.layer_map  = cfg.layer_map;
		this.output_fmt = 'kicad_pcb';

		this.add_elements = function(elements) {
			fp_pcb.push(...elements);
		}

		this.finalize = function() {
			return fp_pcb;
		}

	}; /* constructor */

    return constructor;
}();
