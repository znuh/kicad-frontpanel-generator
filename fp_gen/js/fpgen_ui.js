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

function mk_kc_layermap_table() {
	const tbody = document.getElementById('tb_layermap');
	const tr_template = document.getElementById('tr_layermap').content.firstElementChild;

	const output_layers = [
		'Unassigned',
		'Edge.Cuts',
		'F.SilkS', 'F.Cu', 'F.Mask', 'F.Cu + F.Mask',
		'B.SilkS', 'B.Cu', 'B.Mask', 'B.Cu + B.Mask',
	];

	const kicad_layer_colors = {
		'User.1' : '#c2c2c2',
		'User.2' : '#5994dc',
		'User.3' : '#b4dbd2',
		'User.4' : '#d8c852',
	};

	function mk_output_layers(sel_node, input_layer) {
		sel_node.dataset.input_layer = input_layer;
		output_layers.forEach(ols_entry => {
			const opt = document.createElement("option");
			opt.value = ols_entry;
			opt.text = ols_entry;
			opt.selected = config.kicad_output.layer_map[input_layer].join(' + ') === ols_entry;
			sel_node.add(opt);
		});
	}

	/* data translation / mapping functions */
	const role_transl = {
		layer_in_color	: (n, lname) => {n.style.backgroundColor = kicad_layer_colors[lname] ?? "#ffffff"; },
		layer_in_name	: (n, lname) => {n.textContent = lname; },
		layers_out		: (n, lname) => {mk_output_layers(n, lname); },
	};

	function process_roles(node, lname) {
		const roleNodes = node.querySelectorAll('[data-role]');
		roleNodes.forEach(node => {
			const role = node.dataset.role;
			if(role_transl[role])
				role_transl[role](node, lname);
			else
				console.log("process_roles / missing role mapping:", role);
		});
	}

	Object.keys(config.kicad_output.layer_map).forEach(l => {
		const tr = tr_template.cloneNode(true);
		process_roles(tr, l);
		tbody.appendChild(tr);
	});
}

function update_config() {
	const role_funcs = {
		layer_map		: n => {
			const input_layer   = n.dataset.input_layer;
			const output_layers = ((n.value === 'Unassigned') ? [] : n.value.split(' + '));
			config.kicad_output.layer_map[input_layer] = output_layers;
		},
		keep_3d_models	: n => { config.kicad_output.keep_3d_models = n.checked; },
		z_ofs			: n => { config.kicad_output.models_offset_adjust[2] = (parseFloat(n.value) || 0); },
	};

	document.querySelectorAll('[data-config]').forEach( n => {
		const cfg_id = n.dataset.config;
		role_funcs[cfg_id](n);
	});
	//console.log("config:", config);
}

function SVG_Test() {
	const gen_SVG = new SVG_FP(config.SVG_output);
	const rootg = pcb_to_fp(source_pcb.pcb, gen_SVG);

	const svg = document.createElementNS(SVG_NS, "svg");
	svg.appendChild(rootg);
	//console.log(svg.getBBox());
/*
	const bbox = rootg.getBBox();
	const padding = 16;
	const viewbox = `${bbox.x - padding} ${bbox.y - padding} ${bbox.width + padding * 2} ${bbox.height + padding * 2}`;
	console.log(rootg, viewbox, bbox);

	svg.setAttribute("viewBox", viewbox);
	*/
	document.getElementById('svg_display').replaceChildren(svg);
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

async function pcb_download(kicad_pcb) {
	const fname  = source_pcb.fname.replaceAll(".kicad_pcb","-frontpanel.kicad_pcb");
	const blobby = new Blob([kicad_pcb], {type: "text/plain"});

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

document.addEventListener("DOMContentLoaded", function() {

	/* clear value on click to allow reloading the same file */
	const file_upload = document.getElementById('kicad_file_upload');
	file_upload.addEventListener('click', e => e.target.value="");
	file_upload.addEventListener('change', e => fileReader(e,KicadLoader), false);

	/* add click to drop note */
	document.getElementById('drop_note').addEventListener('click', () => { file_upload.click(); });

	ui_dropzone_setup(file_upload);

	/* Dowload PCB FP */
	const pcb_dl_btn = document.getElementById('download_pcb');
	pcb_dl_btn.disabled = true;
	pcb_dl_btn.addEventListener('click', () => {
		update_config();
		const kicad_pcb = make_PCB_frontpanel();
		pcb_download(kicad_pcb);
	});

	/* Dowload SVG FP */
	const svg_dl_btn = document.getElementById('download_SVG');
	svg_dl_btn.addEventListener('click', () => {
		svg_download();
	});

	/* setup theme switching */
	ui_theme_setup();

	/* make KiCad Layer mapping table */
	mk_kc_layermap_table();

	/* apply default settings from config & sanitize z_ofs input */
	document.getElementById('cb_keep_3d').checked = config.kicad_output.keep_3d_models;
	const zofs_input = document.getElementById('z_ofs');
	zofs_input.value = config.kicad_output.models_offset_adjust[2];
	zofs_input.addEventListener('input', (e) => {
		const val = e.target.value;
		e.target.value = val.replace(/[^0-9.-]/g, '');
	});

});
