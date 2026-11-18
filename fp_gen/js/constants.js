
const SVG_NS = "http://www.w3.org/2000/svg";

const kicad_layer_colors = {
	'User.1' : '#c2c2c2',
	'User.2' : '#5994dc',
	'User.3' : '#b4dbd2',
	'User.4' : '#d8c852',
};

const kicad_input_layers = [
	'User.1', 'User.2', 'User.3', 'User.4'
];

const kicad_output_layers = [
	'Unassigned',
	'Edge.Cuts',
	'F.SilkS', 'F.Cu', 'F.Mask', 'F.Cu + F.Mask',
	'B.SilkS', 'B.Cu', 'B.Mask', 'B.Cu + B.Mask',
];

const soldermask_colors = {
	'black'  : '#000000',
	'white'  : '#ffffff',
	'blue'   : '#153e81',
	'purple' : '#3d1c4f',
	'green'  : '#0b5222',
	'red'    : '#c62923',
	'yellow' : '#f1b400',
};

const mask_opacity = {
	[soldermask_colors.black]  : 0.9,
	[soldermask_colors.white]  : 0.9,
	[soldermask_colors.blue]   : 0.9,
	[soldermask_colors.purple] : 0.9,
	[soldermask_colors.green]  : 0.9,
	[soldermask_colors.red]    : 0.9,
	[soldermask_colors.yellow] : 0.7,
};

const surface_colors = {
	'HASL'   : '#e2e2e2',
	'ENIG'   : '#fbdf17',
};

const FR4_color = '#dfd6c4';
const Cu_color  = '#cd7b5b';

const default_config = {

	kicad_output : {
		keep_3d_models 			: true,
		models_offset_adjust	: [0, 0, -8],
		layer_map : {
			'User.1'	:	["Edge.Cuts"],
			//'User.2'	:	["F.Mask"],
			'User.2'	:	["B.Mask"],
			'User.3'	:	["F.SilkS"],
			'User.4'	:	["F.Cu", "F.Mask"],
			//'User.4'	:	["F.Cu"],
		},
	},

	SVG_output : {
		layer_map : {
			/*
			'User.1' : '#c2c2c2',
			'User.2' : '#5994dc',
			'User.3' : '#b4dbd2',
			'User.4' : '#d8c852',
			*/
			'User.1' : '#ff0000',
			'User.2' : '#00ff00',
			'User.3' : '#0000ff',
			'User.4' : '#ff8000',
		},
		//padding 	 : 5,	// default in SVG_FP.update_extents
		//scale_text 	 : 1.5,		// default in SVG_FP.update_texts
		//font		 : "Arial, Helvetica, sans-serif",	// default in SVG_FP.update_texts
		//fill_opacity : 0.5,
	},

	kicad_preview : {
		layer_map : {
			'F.Cu'      : '#fbdf17',
			'F.Mask'    : '#000000',
			'F.SilkS'   : '#ffffff',
			'Edge.Cuts' : '#808080',
		},
		background : FR4_color,
	},
};
