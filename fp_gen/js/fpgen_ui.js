/* Copyright (c) 2026 Benedikt Heinz <zn000h AT gmail.com>
 * Licensed under MIT (https://github.com/znuh/kicad-frontpanel-generator/blob/main/LICENSE)
 */

function ui_theme_setup() {

	function apply_theme() {
		const sys_theme = (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
		const ls_theme  = localStorage.getItem('theme');
		const theme     = (!ls_theme || ls_theme === 'auto') ? sys_theme : ls_theme;
		document.documentElement.setAttribute('data-bs-theme', theme);
	}

	function update_selection(theme) {
		const icon = document.querySelector('.theme-icon-active');
		const new_active = document.querySelector(`[data-bstheme="${theme}"]`);

		document.querySelectorAll('[data-bstheme]').forEach(e => e.classList.remove('active'));
		new_active.classList.add('active');

		icon.textContent = (theme === 'light') ? '☀️' :
			((theme === 'dark') ? '🌙' : '💻');
	}

	update_selection(localStorage.getItem('theme') ?? 'auto');

	/* register event handlers */
	document.querySelectorAll('[data-bstheme]').forEach(btn => {
		btn.addEventListener('click', () => {
			const theme = btn.getAttribute('data-bstheme');
			localStorage.setItem('theme', theme);
			apply_theme();
			update_selection(theme);
		})
	});
}

function ui_dropzone_setup(finput) {
	/* Do not open kicad files directly in browser */
	window.addEventListener('dragover', (e) => e.preventDefault());
	window.addEventListener('drop', (e) => e.preventDefault());

	window.addEventListener('drop', (e) => {
		e.preventDefault();
		const files = e.dataTransfer.files;
		if(files.length !== 1) return;
		finput.files = files;
        finput.dispatchEvent(new Event('change'));
	});
}

/* create dst_parent child nodes from template_id for each entry of entries
 * using the role_transl functions applied to data-role attributes */
function adopt_template(dst_parent, template_id, entries, role_transl) {
	const template = document.getElementById(template_id);

	function process_roles(node, key, val) {
		const roleNodes = node.querySelectorAll('[data-role]');
		roleNodes.forEach(node => {
			const role = node.dataset.role;
			if(role_transl[role])
				role_transl[role](node, key, val);
			else
				console.log("process_roles / missing role mapping:", role);
		});
	}

	for (const [key, val] of Object.entries(entries)) {
		const cloned = template.content.cloneNode(true);
		process_roles(cloned, key, val);
		dst_parent.append(cloned);
	}
}

function mk_kicad_preview_radios() {
	const mask_group = document.getElementById('preview_soldermask_color');
	const silkscreen_group = document.getElementById('preview_silkscreen_color');
	const finish_group = document.getElementById('preview_finish_color');
	const cfg = config.kicad_preview;

	let type = 'mask';
	let cfg_entry = 'soldermask_color';

	const role_transl = {
		colorsel_input : (n, cname, col) => {
			n.id   = `${type}_col_${cname}`;
			n.name = type+'_sel';
			n.checked = col === cfg[cfg_entry];
		},
		colorsel_label : (n, cname, col) => {
			n.htmlFor = `${type}_col_${cname}`;
			n.appendChild(document.createTextNode(cname));
		},
		colorsel_color : (n, cname, col) => { n.style.backgroundColor = col; },
	};

	adopt_template(mask_group, 'color_sel_radiobtn', soldermask_colors, role_transl);

	type = 'silk';
	cfg_entry = 'silkscreen_color';
	adopt_template(silkscreen_group, 'color_sel_radiobtn', silkscreen_colors, role_transl);

	type = 'finish';
	cfg_entry = 'surface_color';
	adopt_template(finish_group, 'color_sel_radiobtn', surface_colors, role_transl);
}

function mk_layermap_table(ttype) {
	const tbody = document.getElementById('tb_layermap_'+ttype);
	const kicad_mode = (ttype === 'kicad');
	const svg_mode   = (ttype === 'svg');

	// TBD: add event handler for layer assignment change

	function mk_kicad_output_layers(sel_node, input_layer) {
		/* only keep node when in KiCad -> KiCad mode */
		if (!kicad_mode) {
			sel_node.remove();
			return;
		}
		/* create output layer options */
		sel_node.dataset.input_layer = input_layer;
		kicad_output_layers.forEach(ols_entry => {
			const opt = document.createElement("option");
			opt.value = ols_entry;
			opt.text = ols_entry;
			opt.selected = config.kicad_output.layer_map[input_layer].join(' + ') === ols_entry;
			sel_node.add(opt);
		});
	}

	function mk_svg_output_selection(node, input_layer) {
		/* only keep node when in KiCad -> SVG mode */
		if (!svg_mode) {
			node.remove();
			return;
		}
		/* create output layer options */
		node.dataset.input_layer = input_layer;
		node.value = config.SVG_output.layer_map[input_layer] ?? "#000000";
	}

	/* data translation / mapping functions */
	const role_transl = {
		layer_in_color	 : (n, idx, lname) => {n.style.backgroundColor = kicad_layer_colors[lname] ?? "#ffffff"; },
		layer_in_name	 : (n, idx, lname) => {n.textContent = lname; },
		kicad_layers_out : (n, idx, lname) => {mk_kicad_output_layers(n, lname); },
		svg_color_out	 : (n, idx, lname) => {mk_svg_output_selection(n, lname); },
	};

	adopt_template(tbody, 'tr_layermap', kicad_input_layers, role_transl);
}

function update_config() {
	const role_funcs = {
		layer_map_kicad	: n => {
			const input_layer   = n.dataset.input_layer;
			const output_layers = ((n.value === 'Unassigned') ? [] : n.value.split(' + '));
			config.kicad_output.layer_map[input_layer] = output_layers;
		},
		layer_map_svg	: n => { }, // fall through (already handled on change event)
		keep_3d_models	: n => { config.kicad_output.keep_3d_models = n.checked; },
		z_ofs			: n => { config.kicad_output.models_offset_adjust[2] = (parseFloat(n.value) || 0); },
	};

	document.querySelectorAll('[data-config]').forEach( n => {
		const cfg_id = n.dataset.config;
		const func = role_funcs[cfg_id];
		if (typeof(func) === 'function')
			func(n);
		else
			console.log("missing role_func in update_config: "+cfg_id);
	});
	//console.log("config:", config);
}

let SVG_gen = null; // TESTING ONLY

function SVG_Test() {
	const gen_SVG = new SVG_FP(config.SVG_output, document.getElementById('svg_display'));
	const SVG = pcb_to_fp(source_pcb.pcb, gen_SVG);
	frontpanel.SVG = SVG;
	SVG_gen = gen_SVG; // for TESTING ONLY
	// zoom to fit
	SVG.style.width  = '100%';
	SVG.style.height = 'auto';
	// SVG.removeAttribute('style'); // testing
}

function KicadLoader(str, fname, server_path, mod_time) {
	const supported_kicad_versions = {"9.0" : true, "10.0" : true};
	let version_info = "No file loaded yet.";
	let output_info = "No input file loaded yet.";
	let version_unsupported = false;
	let have_data = false;

	frontpanel = {}; // clear existing data

	try {
		source_pcb = {
			fname 		: fname,
			pcb			: parse_sexpression(str),
		};
		have_data = source_pcb.pcb?.[0] === 'kicad_pcb';
	} catch(e) {}

	document.getElementById('download_pcb').disabled = !have_data;
	document.getElementById('download_SVG').disabled = !have_data;
	if(have_data) {
		/* get & check input file KiCad version */
		const kicad_ver = source_pcb.pcb.find(e => e[0] === "generator_version")?.[1];
		source_pcb.kicad_ver = kicad_ver ? JSON.parse(kicad_ver) : undefined;
		version_info = source_pcb.kicad_ver ?? "UNKNOWN";
		version_unsupported = supported_kicad_versions[source_pcb.kicad_ver] !== true;

		/* Use KiCad 10 output for any version >= 10.0
		 * If source_pcb.kicad_ver is undefined, the input file is probably <9.0
		 * parseFloat will return NaN then and NaN >= 10.0 is false, so 9.0 output will be used.
		 */
		config.kicad_output.output_kicad_version = (parseFloat(source_pcb.kicad_ver) >= 10.0) ? 10.0 : 9.0;
		output_info = "Output KiCad version: " + config.kicad_output.output_kicad_version;

		SVG_Test();
	}
	else {
		const modalElement = document.getElementById('error-modal');
		bootstrap.Modal.getOrCreateInstance(modalElement).show();
	}

	document.getElementById('kicad_version_info').textContent = version_info;
	document.querySelectorAll('[data-role="version_warning"]').forEach(
		n => n.hidden = version_unsupported === false);

	document.getElementById('kicad_output_info').textContent = output_info;
}

function fileReader(e, loader) {
	const file = e.target.files[0];
	if (!file) return;
	let reader = new FileReader();
	reader.onload = evt => loader(evt.target.result, file.name);
	reader.readAsText(file);
}

async function fp_download(fp, parms) {
	const fname  = source_pcb.fname.replaceAll(".kicad_pcb","-frontpanel"+parms.ext);
	const blobby = new Blob([fp], {type: parms.type});

	if (window.showSaveFilePicker != null) {
		const fileHandle = await window.showSaveFilePicker({
			startIn: 'desktop',
			suggestedName: fname,
			types: [{
				description: parms.desc,
				/* '_' in extension isn't allowed, so we cannot pass ".kicad_pcb" here.
				 * Using emtpy extensions array instead and relying on suggestedName. */
				accept: { [parms.type]: [] },
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

async function SVG_download(svg) {
	if (!svg.getAttribute('xmlns'))
		svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

	if (!svg.getAttribute('xmlns:xlink'))
		svg.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');

	const serializer = new XMLSerializer();
	let svg_str = serializer.serializeToString(svg);
	if (!svg_str.startsWith('<?xml'))
		svg_str = '<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n' + svg_str;

	fp_download(svg_str, {
		ext 	: ".svg",
		type	: "image/svg+xml",
		desc	: "SVG Vector Graphic",
	});
}

function show_container(div, show) {
	if (show)
		document.getElementById(div).classList.remove('d-none');
	else
		document.getElementById(div).classList.add('d-none');
}

let kc_init_done = false, svg_init_done = false;

function output_fmt_changed(evt) {
	const node = evt.target;
	const val  = node.value;
	const kicad_output = (val === 'kicad_pcb');
	const svg_output   = (val === 'svg');

	/* Create notes if not yet done */
	if (kicad_output && !kc_init_done) {
		kc_init_done = true;
		mk_layermap_table("kicad");
		mk_kicad_preview_radios();
	}
	else if(svg_output && !svg_init_done) {
		svg_init_done = true;
		mk_layermap_table("svg");
	}

	/* Config card */
	show_container('output_info_no_fmt', false);
	show_container('cfg_kicad', kicad_output);
	show_container('cfg_SVG',   svg_output);

	/* Preview card */
	show_container('kicad_preview_cfg', kicad_output);
	show_container('svg_preview_cfg',   svg_output);

	/* Download card */
	show_container('cfg_empty', false);
	show_container('kicad_output_info', kicad_output);
	document.getElementById('download_pcb').hidden = !kicad_output;
	document.getElementById('download_SVG').hidden = !svg_output;
}

document.addEventListener("DOMContentLoaded", function() {

	/* Clear value on click to allow reloading the same file */
	const file_upload = document.getElementById('kicad_file_upload');
	file_upload.addEventListener('click', e => e.target.value="");
	file_upload.addEventListener('change', e => fileReader(e,KicadLoader), false);

	/* Add click to drop note */
	document.getElementById('drop_note').addEventListener('click', () => { file_upload.click(); });

	ui_dropzone_setup(file_upload);

	/* Output format selection */
	document.getElementById('output_fmt').addEventListener('input', output_fmt_changed);

	/* Preview background selection */
	document.getElementById('preview_bg').addEventListener('input', (evt) => {
		const color = evt.target.value;
		const disp  = document.getElementById('svg_display');
		disp.style.backgroundColor = color;
	});

	/* Dowload PCB FP */
	const pcb_dl_btn = document.getElementById('download_pcb');
	pcb_dl_btn.disabled = true;
	pcb_dl_btn.addEventListener('click', () => {
		update_config();
		const kicad_pcb = make_PCB_frontpanel();
		fp_download(kicad_pcb, {
			ext 	: ".kicad_pcb",
			type	: "text/plain",
			desc	: "KiCad PCB file",
		});
	});

	/* Dowload SVG FP */
	const svg_dl_btn = document.getElementById('download_SVG');
	svg_dl_btn.addEventListener('click', () => {
		/* Make a clone with the style attribute removed */
		const clone = frontpanel.SVG.cloneNode(true);
		clone.removeAttribute('style');
		SVG_download(clone);
	});

	/* setup theme switching */
	ui_theme_setup();

	/* apply default settings from config & sanitize z_ofs input */
	document.getElementById('cb_keep_3d').checked = config.kicad_output.keep_3d_models;
	const zofs_input = document.getElementById('z_ofs');
	zofs_input.value = config.kicad_output.models_offset_adjust[2];
	zofs_input.addEventListener('input', (e) => {
		const val = e.target.value;
		e.target.value = val.replace(/[^0-9.-]/g, '');
	});

});
