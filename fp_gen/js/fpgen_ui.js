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
			opt.selected = config.layer_map[input_layer].join(' + ') === ols_entry;
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

	Object.keys(config.layer_map).forEach(l => {
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
			config.layer_map[input_layer] = output_layers;
		},
		keep_3d_models	: n => { config.keep_3d_models = n.checked; },
		z_ofs			: n => { config.models_offset_adjust[2] = (parseFloat(n.value) || 0); },
	};

	document.querySelectorAll('[data-config]').forEach( n => {
		const cfg_id = n.dataset.config;
		role_funcs[cfg_id](n);
	});
	//console.log("config:", config);
}

document.addEventListener("DOMContentLoaded", function() {

	/* clear value on click to allow reloading the same file */
	const file_upload = document.getElementById('kicad_file_upload');
	file_upload.addEventListener('click', e => e.target.value="");
	file_upload.addEventListener('change', e => fileReader(e,KicadLoader), false);

	/* add click to drop note */
	document.getElementById('drop_note').addEventListener('click', () => { file_upload.click(); });

	ui_dropzone_setup(file_upload);

	/* Dowload FP */
	const dl_btn = document.getElementById('download_pcb');
	dl_btn.disabled = true;
	dl_btn.addEventListener('click', () => {
		update_config();
		make_frontpanel();
		pcb_download();
	});

	/* setup theme switching */
	ui_theme_setup();

	/* make KiCad Layer mapping table */
	mk_kc_layermap_table();

	/* apply default settings from config & sanitize z_ofs input */
	document.getElementById('cb_keep_3d').checked = config.keep_3d_models;
	const zofs_input = document.getElementById('z_ofs');
	zofs_input.value = config.models_offset_adjust[2];
	zofs_input.addEventListener('input', (e) => {
		const val = e.target.value;
		e.target.value = val.replace(/[^0-9.-]/g, '');
	});

});
