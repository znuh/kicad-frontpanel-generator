The frontpanel configuration can be specified directly in the KiCad PCB file by adding a simple text in the **User.Comments** layer.  
The first line of this text must be: `Frontpanel:` After this you can define the layer map.

### Example (KiCad output) ###
    Frontpanel:
     User.1 -> Edge.Cuts
     User.2 -> B.SilkS
     User.3 -> F.SilkS
     User.4 -> F.Cu, F.Mask
     z_ofs: -8

### Example (SVG output) ###
You can do the same for SVG colors:

    Frontpanel:
     User.1 -> #0000ff
     User.2 -> #ff0000
     User.3 -> #00ff00
     User.4 -> #ff00ff

### Example (KiCad + SVG) ###
To define layer maps for both KiCad and SVG output you can mix both definitions:

    Frontpanel:
     User.1 -> Edge.Cuts / #0000ff
     User.2 -> B.SilkS / #ff0000
     User.3 -> F.SilkS / #00ff00
     User.4 -> F.Cu, F.Mask / #ff00ff
     z_ofs: -8

Using seperate lines for the KiCad / SVG definitions in one or multiple texts also works.

### Additional KiCad Output Options ###
* Each of these options must be put into a separate line. (See initial KiCad output example.)
* The Z-axis offset for 3D models can be specified with `z_ofs:` e.g. `z_ofs: -8.1`
* If you do not want to keep 3D models in the frontpanel just add a line with `no_3d_models`

### Notes ###
* Apart from the initial `Frontpanel:` line you can use spaces for indentation as you like.
* Indentation is optional.
