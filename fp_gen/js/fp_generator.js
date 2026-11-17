/* Copyright (c) 2025, 2026 Benedikt Heinz <zn000h AT gmail.com>
 * Licensed under MIT (https://github.com/znuh/kicad-frontpanel-generator/blob/main/LICENSE)
 */

/* Further ideas:
 * - save config to / load from localStorage
 * - read config from User.Comments text(s) in KiCad input board
 * - UI: button + modal to generate & show User.Comments config entry for current config
 * - UI: option to keep/convert/drop knockout text for SVG output (laser fps)
 */

/* Holds the input KiCad PCB */
let source_pcb = null;

/* All the config stuff goes into this object. See default_config in constants.js. */
let config = null;

/* Big static object holding all our internal stuff. */
const fpgen = {

	/* SVG: SVG object which can be displayed in preview
	 * SVG_gen: The SVG generator object
	 *
	 * These values are null/undefined if user never selected the
	 * corresponding output format. */

	SVG_output : {
		//SVG			: null,
		//SVG_gen		: null,
	},

	kicad_output : {
		//preview_fp	: null, // generated frontpanel for preview
		//SVG			: null,
		//SVG_gen		: null,
	},
};

function fpgen_reset() {
	source_pcb = null;

	delete fpgen.SVG_output.SVG;
	delete fpgen.SVG_output.SVG_gen;

	delete fpgen.kicad_output.preview_fp;
	delete fpgen.kicad_output.SVG;
	delete fpgen.kicad_output.SVG_gen;
}

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

/* Import/convert/sanitize text from kicad fp_text or gr_text element.
 * Returns array of text lines. */
function import_text(se) {
	/* Text examples:
	 *  fp_text value 20k
	 *  fp_text user "foobar"
	 *  gr_text bot
	 *  gr_text "AP3513E"
	 * => use se[2] for fp_text, se[1] otherwise
	 * => pass through JSON.parse if first char is a double quote */
	let actual_text = ((se[0] === "fp_text") ? se[2] : se[1]);

	/* Text in KiCad can include at least 'tab' as unescaped 0x09 bytes.
	 * So we need to sanitize the input before throwing it into JSON.parse. */
	actual_text = actual_text.replace(/[\x00-\x1f]/g, '');

	if (actual_text.charAt(0) === "\"")
		actual_text = JSON.parse(actual_text);

	/* KiCad encodes '"' in text as '{dblquote}', so we have to replace these. */
	actual_text = actual_text.replaceAll('{dblquote}','"');

	return actual_text.split("\n");
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
		else if((elem[0] == "layer") && (JSON.parse(elem[1]) in layer_map))
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

function make_PCB_frontpanel() {
	const fp_template = (config.kicad_output.output_kicad_version < 10.0) ? 
		fp_template_kicad9 : fp_template_kicad10;
	const gen_kicad = new Kicad_FP(config.kicad_output, fp_template);
	return pcb_to_fp(source_pcb.pcb, gen_kicad);
}
