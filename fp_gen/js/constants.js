
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
	'green'  : '#30523a',
	'red'    : '#c62923',
	'yellow' : '#f1b400',
};

const silkscreen_colors = {
	'black'  : '#000000',
	'white'  : '#ffffff',
};

const surface_colors = {
	'HASL'   : '#e2e2e2',
	'ENIG'   : '#fbdf17',
};
