
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
