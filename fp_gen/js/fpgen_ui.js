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
		});
	});
}

function SVG_has_masks(SVG) {
	/* We simply look for a group which is a direct child of the SVG that's
	 * active (display!=none) and has a rect child with a mask set. */
	const groups = SVG.querySelectorAll(':scope > g');
	return Array.from(groups).some( g => {
		const active = g.getAttribute('display') !== 'none';
		return active && !!g.querySelector('rect[mask]');
	});
}

/* base_id: 'error-modal' for error modal ;)
 *          or 'notify-toast' for a smol notification toast. */
function ui_message(base_id, parms) {
	document.getElementById(base_id+'-title').textContent = parms.title;

	const txt_el = document.getElementById(base_id+'-text');
	if (parms.html)
		txt_el.innerHTML = parms.html;
	else
		txt_el.innerText = parms.text;

	const element  = document.getElementById(base_id);
	const instance = base_id.includes('toast') ?
		bootstrap.Toast.getOrCreateInstance(element) :
		bootstrap.Modal.getOrCreateInstance(element);
	instance.show();
}

/* Setup file drop zone for .kicad_pcb files */
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

function save_config_ls() {
	const fname = source_pcb?.fname ?? 'no_file';
	// save to localStorage
	localStorage.setItem(fname, JSON.stringify(config));
}

/* Called when user changed a preview color for the kicad preview */
function kicad_preview_color_changed(evt) {
	const node = evt.target;
	const input_layer = node.name;
	const color = node.dataset.color;
	const cfg = config.kicad_preview.layer_map;

	cfg[input_layer] = color;
	//console.log(input_layer, color);

	fpgen.kicad_output.SVG_gen?.update_layer(input_layer);

	if (input_layer === 'F.Mask') {
		/* Black silkscreen only makes sense for white soldermask. */
		const silkscreen_color = (node.id.indexOf('_white') >= 0) ? '#000000' : '#ffffff';
		if (silkscreen_color !== cfg['F.SilkS']) {
			cfg['F.SilkS'] = silkscreen_color;
			fpgen.kicad_output.SVG_gen?.update_layer('F.SilkS');

			/* Update Silkscreen color */
			document.getElementById('preview_silkscreen_color').style.backgroundColor = silkscreen_color;
			document.getElementById('preview_silkscreen_cname').textContent =
				(silkscreen_color === '#000000') ? 'black' : 'white';
		}
	}
	save_config_ls();
}

/* Make the KiCad preview radio buttons for soldermask and surface finish.
 * Call this only once when user chooses kicad output for the first time. */
function mk_kicad_preview_radios() {
	const mask_group   = document.getElementById('preview_soldermask_color');
	const finish_group = document.getElementById('preview_finish_color');
	const cfg = config.kicad_preview.layer_map;

	let cfg_entry = 'F.Mask';

	const role_transl = {
		colorsel_input : (n, cname, col) => {
			n.id   = `${cfg_entry}_col_${cname}`;
			n.name = cfg_entry;
			n.dataset.color = col;
			n.checked = col === cfg[cfg_entry];
		},
		colorsel_label : (n, cname, col) => {
			n.htmlFor = `${cfg_entry}_col_${cname}`;
			n.appendChild(document.createTextNode(cname));
		},
		colorsel_color : (n, cname, col) => { n.style.backgroundColor = col; },
	};

	adopt_template(mask_group, 'color_sel_radiobtn', soldermask_colors, role_transl);
	mask_group.addEventListener('change', kicad_preview_color_changed);

	/* set initial silkscreen color */
	document.getElementById('preview_silkscreen_color').style.backgroundColor = cfg.silkscreen_color;
	document.getElementById('preview_silkscreen_cname').textContent =
		(cfg.silkscreen_color === '#000000') ? 'black' : 'white';

	cfg_entry = 'F.Cu';
	adopt_template(finish_group, 'color_sel_radiobtn', surface_colors, role_transl);
	finish_group.addEventListener('change', kicad_preview_color_changed);
}

/* Called when user changed an entry of the SVG layer map.
 * Layer map: 1 KiCad input layer -> 1 SVG output color */
function SVG_layermap_changed(evt) {
	const node   = evt.target;
	const layer_active = !node.disabled;
	const input_layer  = node.dataset.input_layer;
	const color = layer_active ? node.value : null;
	const cfg = config.SVG_output;
	cfg.layer_map[input_layer] = color; // update config
	save_config_ls();

	if (!fpgen.SVG_output.SVG_gen)
		return;

	/* Invoke SVG gen update method */
	fpgen.SVG_output.SVG_gen.update_layer(input_layer);

	/* Update knockout warning visibility */
	document.getElementById('knockout_warning').hidden = !SVG_has_masks(fpgen.SVG_output.SVG);
}

/* Called when user changed an entry of the kicad -> kicad layer map.
 * This map is different from the SVG layer map:
 * 1 KiCad input layer -> N KiCad output layer(s) */
function kicad_layermap_changed(evt) {
	const node = evt.target;
	const input_layer   = node.dataset.input_layer;
	const output_layers = ((node.value === 'Unassigned') ? [] : node.value.split(' + '));
	const cfg = config.kicad_output;
	cfg.layer_map[input_layer] = output_layers;
	save_config_ls();

	if (!source_pcb)
		return;

	/* Clear old SVG first */
	document.getElementById('svg_display').replaceChildren();

	/* Invalidate old stuff first */
	delete fpgen.kicad_output.SVG;
	delete fpgen.kicad_output.SVG_gen;
	delete fpgen.kicad_output.preview_fp;

	update_preview('kicad');
}

/* Make layer map table for KiCad or SVG - depending on ttype */
function mk_layermap_table(ttype) {
	const tbody = document.getElementById('tb_layermap_'+ttype);
	const kicad_mode = (ttype === 'kicad');
	const svg_mode   = (ttype === 'SVG');

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

		/* attach change event handler */
		sel_node.addEventListener('change', kicad_layermap_changed);
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

		/* attach change event handler */
		node.addEventListener('change', SVG_layermap_changed);
	}

	/* data translation / mapping functions */
	const role_transl = {
		layer_in_color	 : (n, idx, lname) => {n.style.backgroundColor = kicad_layer_colors[lname] ?? "#ffffff"; },
		layer_in_name	 : (n, idx, lname) => {n.textContent = lname; },
		kicad_layers_out : (n, idx, lname) => {mk_kicad_output_layers(n, lname); },
		svg_color_out	 : (n, idx, lname) => {mk_svg_output_selection(n, lname); },

		svg_layer_enable : (n, idx, lname) => {
			if (!svg_mode) return;
			n.hidden = false;
			n.addEventListener('change', (evt) => {
				const en = evt.target.checked;
				const cin = n.previousElementSibling?.firstElementChild;
				cin.disabled = !en;
				if (en)
					cin.classList.remove('opacity-50');
				else
					cin.classList.add('opacity-50');
				cin.dispatchEvent(new Event('change'));
			});
		}, // svg_layer_enable
	};

	adopt_template(tbody, 'tr_layermap', kicad_input_layers, role_transl);
}

function apply_kicad_cfg(kc_cfg) {
	config.kicad_output = kc_cfg;
	config.output_mode = 'kicad';
	// TBD: update UI
	document.getElementById('cb_keep_3d').checked = config.kicad_output.keep_3d_models != false;
	document.getElementById('z_ofs').value = config.kicad_output?.models_offset_adjust?.[2] ?? -8;
}

function apply_SVG_cfg(SVG_cfg) {
	config.SVG_output = SVG_cfg;
	config.output_mode = 'SVG';
	// TBD: update UI
}

function update_preview(output_mode) {
	output_mode ??= document.getElementById('output_fmt').value;

	//console.log("update_preview " + output_mode);

	if (!output_mode || !source_pcb)
		return;

	const kicad_output = (output_mode === 'kicad');
	const svg_output   = (output_mode === 'SVG');
	const output = fpgen[output_mode+'_output'];

	const display_node = document.getElementById('svg_display');

	/* If we do not have an SVG for the selected output yet, generate it now. */
	if (!output.SVG) {
		/* For KiCad preview we let the KiCad -> KiCad generator do the initial
		 * layer remapping. After this we use the preview colors on the result. */
		if (kicad_output)
			output.preview_fp ??= make_PCB_frontpanel();
		const input_pcb = kicad_output ? output.preview_fp : source_pcb.pcb;
		const cfg     = svg_output ? config.SVG_output : config.kicad_preview;
		const SVG_gen = new SVG_FP(cfg, display_node);
		const SVG     = pcb_to_fp(input_pcb, SVG_gen);

		output.SVG_gen = SVG_gen;
		output.SVG     = SVG;

		// zoom to fit
		SVG.style.width  = '100%';
		SVG.style.height = 'auto';
		// SVG.removeAttribute('style'); // testing
	}
	else {
		/* If we already had an SVG for the selected output, we replace
		 * the SVG. This isn't needed when we just created a fresh SVG,
		 * because the finalize method of SVG generator already did the replace. */
		display_node.replaceChildren(output.SVG);
	}

	/* Update knockout warning visibility */
	document.getElementById('knockout_warning').hidden = !(svg_output && SVG_has_masks(fpgen.SVG_output.SVG));
}

function import_config_pcb() {
	/* Find config in gr_text elements with layer == Cmts.User
	 * There can be multiple configs - e.g. one for KiCad output
	 * and another one for SVG output. */
	const cfg_texts = source_pcb.pcb.filter(e => {
		if (!(e[0] === "gr_text" && e[1]?.toLowerCase().startsWith('"frontpanel')))
			return false;
		let layer = find_token(e, "layer")?.[1];
		layer = (layer.charAt(0) === "\"") ? JSON.parse(layer) : layer;
		return layer === "Cmts.User";
	});

	if (!cfg_texts.length) return [null, null];

	let kicad_output_cfg = null, SVG_output_cfg = null;

	/* Sane base configs with all layers disabled */
	function kc_cfg() {
		kicad_output_cfg ??= {
			keep_3d_models 			: true,
			models_offset_adjust	: [0, 0, -8],
			layer_map : {
				'User.1' : [],
				'User.2' : [],
				'User.3' : [],
				'User.4' : [],
			},
		};
		return kicad_output_cfg;
	}

	function SVG_cfg() {
		SVG_output_cfg ??= {
			padding		: 5,
			scale_text	: 1.5,
			font		: "Arial, Helvetica, sans-serif",
			layer_map 	: {},
		};
		return SVG_output_cfg;
	}

	// Regexp for matching KiCad PCB layers
	const pcb_layer_re = /^\w+\.\w+$/;
	const is_pcb_layer = s => !!s.match(pcb_layer_re);

	/* Regexp for matching:
	 * 1) numbers - e.g. (-)3.453 (used for z_ofs value)
	 * 2) hex rgb colors (e.g. #0033ff)
	 * 3) KiCad layers (e.g. Cmts.User) and config keys (e.g. z_ofs, no_3d_models)
	 * Group 3) is quite liberal. No strict sanity checking for valid KiCad layers. */
	const cfg_re = /(-?\d+(\.\d+))|(#[\da-fA-F]{6})|([\w\.]+)/g;

	/* cfg_texts[0] contains 1st Frontpanel: text block,
	 * cfg_texts[1] the second - if there is one - and so on.
	 * - import_text converts the text string to a string array with one line == one element.
	 * - slice(1) drops the initial "Frontpanel:" marker line.
	 * - flat() is used to make a single array from all config lines spanning all config texts */
	cfg_texts.map(te => import_text(te).slice(1)).flat().forEach(line => {
		const vals = [...line.matchAll(cfg_re)].map(cap => !isNaN(cap[0]) ? +cap[0] : cap[0]);
		const key = vals.shift();
		const key_is_layer = is_pcb_layer(key);
		//console.log(key, key_is_layer, vals);

		if (key_is_layer) {
			vals.forEach(tl => {
				const is_layer = is_pcb_layer(tl);
				const is_color = tl.startsWith('#');
				//console.log("assign "+tl, is_layer, is_color);

				if (!is_color && !is_layer)
					throw new Error('Config syntax error - invalid layer assignment: '+tl+'\nLine: '+line);

				// assign target layer to map
				if (is_color)
					SVG_cfg().layer_map[key] = tl;
				else {
					const target_layers = kc_cfg().layer_map[key];
					if (!target_layers.includes(tl))
						target_layers.push(tl);
				}
			});
		}
		else { // non-layer config options
			switch(key) {
				case 'no_3d_models':
					kc_cfg().keep_3d_models = false;
					break;
				case 'z_ofs':
					if (isNaN(vals[0]))
						throw new Error('Config syntax error - invalid value for z_ofs: '+vals[0]+'\nLine: '+line);
					kc_cfg().models_offset_adjust = [0, 0, vals[0]];
					break;
				default:
					throw new Error('Config syntax error - unknown option: '+key+'\nLine: '+line);
			}
		}
	});

	return [kicad_output_cfg, SVG_output_cfg];
}

function KicadLoader(str, fname, server_path, mod_time) {
	const supported_kicad_versions = {"9.0" : true, "10.0" : true};
	let version_info = "No file loaded yet.";
	let output_info = "No input file loaded yet.";
	let version_unsupported = false;
	let have_data = false;
	let config_imported = false;

	fpgen_reset();

	/* Clear old SVG first */
	document.getElementById('svg_display').replaceChildren(
		document.createTextNode('No data yet.'));

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

		/* See if we find a Frontpanel Configuration Text in the PCB */
		try {
			const [kc_cfg, SVG_cfg] = import_config_pcb();
			config_imported = kc_cfg || SVG_cfg;
			if (kc_cfg)
				apply_kicad_cfg(kc_cfg);
			if (SVG_cfg)
				apply_SVG_cfg(SVG_cfg);
			if (config_imported) {
				ui_message('notify-toast', {
					title : '🛈 Note',
					text  : 'Layer map imported from Cmts.User text.',
				});
			}
		} catch(e) {
			ui_message('error-modal', {
				title : 'Error Parsing Frontpanel Configuration',
				text  : e,
			});
		}

		// TODO: overwrite config.output_mode with ls value - if exists
		//const previous_config = JSON.parse(localStorage.getItem(source_pcb.fname));
		//config.output_mode = ...

		if (config_imported)
			save_config_ls();

		// TODO: apply previous cfg if present and no config imported

		localStorage.setItem('last_file', source_pcb.fname);

		update_preview();
	}
	else {
		ui_message('error-modal', {
			title : 'Loading input file failed',
			html  : '<b>Could not load input file.</b><br>Make sure you are using a <code>.kicad_pcb</code> file for a recent KiCad version.'
		});
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

async function SVG_download(ref_svg) {
	ref_svg ??= document.getElementById('svg_display').firstElementChild;

	/* Make a clone with the style attribute removed */
	const svg = ref_svg.cloneNode(true);
	svg.removeAttribute('style');

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

function output_fmt_changed(evt) {
	const node = evt.target;
	const output_mode  = node.value;
	const kicad_output = (output_mode === 'kicad');
	const svg_output   = (output_mode === 'SVG');
	const output = fpgen[output_mode+'_output'];

	/* Create config nodes for selected output if not yet done */
	if(!output.ui_init_done) {
		output.ui_init_done = true;
		//console.log("ui_init", output_mode);
		mk_layermap_table(output_mode);
		if(kicad_output)
			mk_kicad_preview_radios();
	}

	/* Config card */
	show_container('output_info_no_fmt', false);
	show_container('cfg_kicad', kicad_output);
	show_container('cfg_SVG',   svg_output);

	/* Preview card */
	show_container('kicad_preview_cfg', kicad_output);
	show_container('svg_preview_cfg',   svg_output);
	update_preview(output_mode);

	/* Download card */
	show_container('cfg_empty', false);
	show_container('kicad_output_info', kicad_output);
	document.getElementById('download_pcb').hidden = !kicad_output;
	document.getElementById('download_SVG').hidden = !svg_output;

	config.output_mode = output_mode;
	save_config_ls();
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
		const kicad_pcb = encode_sexpression(make_PCB_frontpanel());
		fp_download(kicad_pcb, {
			ext 	: ".kicad_pcb",
			type	: "text/plain",
			desc	: "KiCad PCB file",
		});
	});

	/* Dowload SVG FP */
	const svg_dl_btn = document.getElementById('download_SVG');
	svg_dl_btn.addEventListener('click', () => {
		SVG_download(fpgen.SVG_output.SVG);
	});

	/* setup theme switching */
	ui_theme_setup();

	/* setup toggle for keep 3D models */
	const keep_3d = document.getElementById('cb_keep_3d');
	keep_3d.checked = config.kicad_output.keep_3d_models != false;
	keep_3d.addEventListener('change', (e) => {
		config.kicad_output.keep_3d_models = e.target.checked;
		save_config_ls();
	});

	/* z_ofs default val & input sanitizer */
	const zofs_input = document.getElementById('z_ofs');
	zofs_input.value = config.kicad_output?.models_offset_adjust?.[2] ?? -8;
	zofs_input.addEventListener('input', (e) => {
		const val = e.target.value;
		e.target.value = val.replace(/[^0-9.-]/g, '');
	});

	/* add z_ofs event handler */
	zofs_input.addEventListener('change', (e) => {
		config.kicad_output.models_offset_adjust = [0, 0, (parseFloat(e.target.value) || 0)];
		save_config_ls();
	});

});
