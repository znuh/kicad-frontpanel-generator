/* Copyright (c) 2025, 2026 Benedikt Heinz <zn000h AT gmail.com>
 * Licensed under MIT (https://github.com/znuh/kicad-frontpanel-generator/blob/main/LICENSE)
 */
let source_pcb = null;
let frontpanel = null;

const config = {

	kicad_output : {
		keep_3d_models 			: true,
		models_offset_adjust	: [0, 0, -8],
		layer_map : {
			'User.1'	:	["Edge.Cuts"],
			//'User.2'	:	["B.SilkS"],
			'User.2'	:	["B.Mask"],
			'User.3'	:	["F.SilkS"],
			'User.4'	:	["F.Cu", "F.Mask"],
			//'F.CrtYd'	:	["B.CrtYd"],
		},
	},

	svg_output : {
		// TBD
	}
};

function encode_sexpression(item, ind) {
	if (!Array.isArray(item))
		return String(item);
	const indent = ind ?? "";
	const sub_indent = indent + "\t";
	let sub_arrays = false;
	let buf = "(";
	for(let i = 0; i < item.length; i++) {
		const elem = item[i];
		const is_array = Array.isArray(elem);
		buf += ((i>0) && (!is_array)) ? " " : "";
		// TODO: more xy tuples per line?
		// TODO: don't put all group members into single line?
		buf += is_array ? ("\n" + sub_indent + encode_sexpression(elem, sub_indent)) : String(elem);
		sub_arrays = sub_arrays || is_array;
	}
	if(sub_arrays)
		buf += "\n" + indent;
	return buf + ")";
}

async function pcb_download() {
	const fname  = source_pcb.fname.replaceAll(".kicad_pcb","-frontpanel.kicad_pcb");
	const blobby = new Blob([frontpanel.kicad_pcb], {type: "text/plain"});

	if (window.showSaveFilePicker != null) {
		const fileHandle = await window.showSaveFilePicker({
			startIn: 'desktop',
			suggestedName: fname,
			types: [{
				description: 'KiCad PCB file',
				accept: { 'text/plain': ['.kicadpcb'] },
			}],
		});
		const fileStream = await fileHandle.createWritable();
		await fileStream.write(blobby);
		await fileStream.close();
	} else { // window.showSaveFilePicker not available
		const    a = document.createElement("a");
		a.href     = window.URL.createObjectURL(blobby);
		a.download = fname;
		a.click();
		URL.revokeObjectURL(a.href);
	}
}

/* look up a token by following a given path from elem
 * e.g. find_token(model, "offset", "xyz") */
function find_token(elem, ...path) {
	for (const tok of path) {
		let found = false;
		for (i=1; i<elem.length; i++) {
			const ce = elem[i];
			if (Array.isArray(ce) && (ce[0] == tok)) {
				elem = ce;
				found = true;
				break;
			}
		}
		if (!found)
			return null;
	}
	return elem;
}

/* Convert original PCB to frontpanel
 *
 * pcb: source PCB (parsed KiCad file)
 * gen: generator */
function pcb_to_fp(input_pcb, gen) {
	/* read + cache a few things from generator */
	const layer_map    = gen.layer_map;
	const output_kicad = gen.output_fmt === "kicad_pcb";

	/* determines if a frontpanel layer from layer_map is used
	 * somewhere in the element - does a recursive search */
	function test_fp_layer(elem) {
		if(!Array.isArray(elem))
			return false;
		else if((elem[0] == "layer") && (layer_map[JSON.parse(elem[1])]))
			return true;
		else
			return elem.some((e) => test_fp_layer(e));
	}

	/* convert elements to frontpanel-elements */
	function conv_element(elem) {
		const is_gr = elem[0].startsWith("gr_");
		const is_footprint = (elem[0] == "footprint");

		/* ignore/drop unneeded elements (only keep footprints and gr_* elements) */
		if ((is_footprint || is_gr) && test_fp_layer(elem)) {
			if (is_footprint)
				gen.add_footprint(elem);
			else
				gen.add_gr(elem);
		}
	}

	input_pcb.forEach(conv_element);	/* convert all elements */
	return gen.finalize();
}

function make_frontpanel() {
	const fp_template = (config.kicad_output.output_kicad_version < 10.0) ? 
		fp_template_kicad9 : fp_template_kicad10;
	const gen_kicad = new Kicad_FP(config.kicad_output, fp_template);
	frontpanel = { pcb : pcb_to_fp(source_pcb.pcb, gen_kicad) };
	frontpanel.kicad_pcb = encode_sexpression(frontpanel.pcb);
}
