# Third-party source

The files in `src/vendor/sudokui/` and the technique example fixtures in `tests/technique-examples.json` are copied without modification (except selecting the relevant fixture entries) from [AImenes/sudokUI](https://github.com/AImenes/sudokUI), commit `cf7ce55e09ee7ea879327f4f995f9e603d4fb17a`.

Original paths: `src/engine/` and `src/content/examples.json`. Copyright belongs to the original sudokUI authors. The source is licensed under GNU GPL version 3; its full license is included in `LICENSE`. This derivative project uses the same license.

The local registry in `src/engine/solver.ts` wires the requested techniques only. Some upstream modules contain additional helpers and finders; those are preserved to keep the vendored source intact, but are not registered. Killer cage constraints have not been implemented yet.
