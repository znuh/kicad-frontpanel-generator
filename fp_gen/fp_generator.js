/* Copyright (c) 2025 Benedikt Heinz <zn000h AT gmail.com>
 * Licensed under MIT (https://github.com/znuh/kicad-frontpanel-generator/blob/main/LICENSE)
 */
let source_pcb = null;
let frontpanel = null;

const config = {
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

/* convert original PCB to frontpanel PCB (+ SVG) */
function pcb_to_fp(pcb, layer_map) {

	/* determines if a frontpanel layer (from the layer_map)
	 * is used somewhere in the element - does a recursive search */
	function test_fp_layer(elem) {
		if(!Array.isArray(elem))
			return false;
		else if((elem[0] == "layer") && (layer_map[JSON.parse(elem[1])]))
			return true;
		else
			return elem.some((e) => test_fp_layer(e));
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

	/* footprint tokens we do not want to copy to the frontpanel */
	const footprint_ignore = {
		descr : true, tags : true, property : true, pad : true
	}

	/* convert footprint for frontpanel */
	function footprint_conv(src) {
		const new_name = src[1].replace(/\w+?:/,'frontpanel:');		/* replace library name with 'frontpanel' */
		let res = ["footprint", new_name];							/* create footprint token */

		/* walk through remaining elements */
		for (let i=2; i<src.length; i++) {
			const se = src[i];

			/* pass graphic elements on to gr_conv */
			if (se[0].startsWith("fp_"))
				res.push(...gr_conv(se));

			/* deal with 3D model */
			else if ((se[0] == "model") && config.keep_3d_models) {
				let model = structuredClone(se);
				let ofs = find_token(model, "offset", "xyz");
				for(let j=0; j<3; j++)
					ofs[j+1] += config.models_offset_adjust[j];
				res.push(model);
			}

			/* copy non-ignored sub-elements */
			else if (!footprint_ignore[se[0]])
				res.push(structuredClone(se));
		}
		return [res];
	}

	/* convert elements to frontpanel-elements */
	function conv_element(res, elem) {
		const is_gr = elem[0].startsWith("gr_");
		const is_footprint = (elem[0] == "footprint");
		/* ignore/drop unneeded elements (only keep footprints and gr_* elements) */
		if ((is_footprint || is_gr) && test_fp_layer(elem)) {
			const new_elements = is_gr ? gr_conv(elem) : footprint_conv(elem);
			res.push(...new_elements);
		}
		return res;
	}

	let fp_pcb = structuredClone(fp_template);		/* make a copy of empty PCB template */
	return pcb.reduce(conv_element, fp_pcb);		/* populate empty PCB with frontpanel elements */
}

function KicadLoader(str, fname, server_path, mod_time) {
	source_pcb = {
		fname 		: fname,
		pcb			: parse_sexpression(str),
	};
	frontpanel = { pcb : pcb_to_fp(source_pcb.pcb, config.layer_map) };
	frontpanel.kicad_pcb = encode_sexpression(frontpanel.pcb);
	document.getElementById('txt').textContent = frontpanel.kicad_pcb;
}

function fileReader(e, loader) {
	const file = e.target.files[0];
	if (!file) return;
	let reader = new FileReader();
	reader.onload = evt => loader(evt.target.result, file.name);
	reader.readAsText(file);
}

document.addEventListener("DOMContentLoaded", function() {
	document.getElementById('config').textContent = JSON.stringify(config, null, 0);
	/* clear value on click to allow reloading the same file */
	document.getElementById('kicad_file_upload').addEventListener('click', e => e.target.value="");
	document.getElementById('kicad_file_upload').addEventListener('change', e => fileReader(e,KicadLoader), false);
	document.getElementById('download_pcb').addEventListener('click', pcb_download);
});
