"""QGIS startup script: shows the demo's QGIS view and saves a screenshot.

Loads foss4gna_monument_footprints (a PostGIS view over the Arches demo
database) over an OpenStreetMap basemap, signs the Arches QGIS plugin in to
the demo as a contributor, zooms to Rancho Vega and registers it in the
plugin as the resource to edit, docks the plugin and the attribute table
(filtered to Paul R. Williams's works), grabs the QGIS window and quits. Run
it with scripts/qgis/capture-qgis-screenshot.sh.
"""

import os
import traceback

from qgis.core import (
    Qgis,
    QgsCoordinateReferenceSystem,
    QgsDataSourceUri,
    QgsFillSymbol,
    QgsProject,
    QgsRasterLayer,
    QgsRectangle,
    QgsSettings,
    QgsVectorLayer,
)
from qgis.PyQt.QtCore import Qt, QTimer
from qgis.PyQt.QtWidgets import QApplication, QDialog, QDockWidget, QTableView
from qgis.utils import available_plugins, iface, loadPlugin, plugins, startPlugin

OUTPUT_PATH = os.environ["QGIS_SCREENSHOT_PATH"]
LOG_PATH = os.environ.get("QGIS_SCREENSHOT_LOG", OUTPUT_PATH + ".log")
DRAW_DELAY_MILLISECONDS = int(os.environ.get("QGIS_SCREENSHOT_DELAY_MS", "16000"))
ARCHES_URL = os.environ["ARCHES_URL"]
CONTRIBUTOR_USERNAME = "demo_contributor"
DEMO_PASSWORD = "foss4gna-demo-password"
# Just wide enough for the plugin panel beside the map and table, so the
# large fonts below fill as much of the slide as they can.
WINDOW_WIDTH, WINDOW_HEIGHT = 1700, 1000
TABLE_FONT_POINT_SIZE = 22
PLUGIN_FONT_POINT_SIZE = 17
# Centred on Rancho Vega (Web Mercator), sized for the map area left above
# the docked attribute table.
RANCHO_VEGA_CENTER_X, RANCHO_VEGA_CENTER_Y = -13175797, 4053078
RANCHO_VEGA_EXTENT = QgsRectangle(
    RANCHO_VEGA_CENTER_X - 650,
    RANCHO_VEGA_CENTER_Y - 230,
    RANCHO_VEGA_CENTER_X + 650,
    RANCHO_VEGA_CENTER_Y + 230,
)


def log(message):
    with open(LOG_PATH, "a") as log_file:
        log_file.write(message + "\n")


def logging_errors(step):
    """Runs a timed step, logging any error (QTimer would swallow it)."""

    def run():
        try:
            step()
        except Exception:
            log(traceback.format_exc())

    return run


def add_layers(project):
    project.setCrs(QgsCoordinateReferenceSystem("EPSG:3857"))
    basemap = QgsRasterLayer(
        "type=xyz&url=https://tile.openstreetmap.org/{z}/{x}/{y}.png&zmax=19&zmin=0",
        "OpenStreetMap",
        "wms",
    )
    project.addMapLayer(basemap)

    source = QgsDataSourceUri()
    source.setConnection("localhost", "5432", "foss4gna_demo", "postgres", "postgis")
    source.setDataSource("public", "foss4gna_monument_footprints", "geom", "", "gid")
    source.setSrid("3857")
    # The view's geometry column is untyped, so QGIS needs the type up front.
    source.setWkbType(Qgis.WkbType.MultiPolygon)
    monuments = QgsVectorLayer(
        source.uri(False), "Arches monuments (PostGIS view)", "postgres"
    )
    log(f"monuments layer valid={monuments.isValid()}")
    if not monuments.isValid():
        raise RuntimeError(
            f"{monuments.error().summary()} | {monuments.dataProvider().error().summary()}"
        )
    monuments.renderer().setSymbol(
        QgsFillSymbol.createSimple(
            {
                "color": "196,21,26,90",
                "outline_color": "196,21,26,255",
                "outline_width": "0.5",
            }
        )
    )
    # The table is about the relationship-derived architect column, not the
    # keys. Designation is hidden too: which works aren't landmarks is the
    # demo's question, asked after this slide.
    table_config = monuments.attributeTableConfig()
    columns = table_config.columns()
    hidden_columns = ("gid", "resourceinstanceid", "tileid", "nodeid", "designation")
    for column in columns:
        column.hidden = column.name in hidden_columns
    table_config.setColumns(columns)
    table_config.setSortExpression('"built"')
    table_config.setActionWidgetVisible(False)
    monuments.setAttributeTableConfig(table_config)
    project.addMapLayer(monuments)
    return monuments


def prepare_window():
    window = iface.mainWindow()
    window.showNormal()
    window.resize(WINDOW_WIDTH, WINDOW_HEIGHT)
    QgsSettings().setValue("qgis/dockAttributeTable", True)
    return window


def sign_in_to_arches():
    """Opens the Arches plugin and signs in; the connection runs as a task."""
    if "arches_project" not in plugins:
        loaded = loadPlugin("arches_project") and startPlugin("arches_project")
        log(f"plugin loaded={loaded}; available={'arches_project' in available_plugins}")
    arches_plugin = plugins["arches_project"]
    arches_plugin.run()
    plugin_dialog = arches_plugin.dlg
    plugin_dialog.archesServerInput.setText(ARCHES_URL)
    plugin_dialog.usernameInput.setText(CONTRIBUTOR_USERNAME)
    plugin_dialog.passwordInput.setText(DEMO_PASSWORD)
    plugin_dialog.btnConnect.click()
    log("plugin sign-in started")


def register_rancho_vega(monuments):
    """Registers the selected Rancho Vega as the plugin's resource to edit,
    then docks the plugin beside the map so one grab shows it."""
    plugin_dialog = plugins["arches_project"].dlg
    plugin_dialog.tabWidget.setCurrentWidget(plugin_dialog.editResource)
    plugin_dialog.editResSelectResButton.click()
    # Registering clears the selection; select it again for the map.
    monuments.selectByExpression("\"name\" = 'Rancho Vega'")
    plugin_dialog.setWindowFlags(Qt.WindowType.Widget)
    plugin_font = plugin_dialog.font()
    plugin_font.setPointSize(PLUGIN_FONT_POINT_SIZE)
    plugin_dialog.setFont(plugin_font)
    dock = QDockWidget("Arches Project plugin", iface.mainWindow())
    dock.setWidget(plugin_dialog)
    iface.addDockWidget(Qt.DockWidgetArea.RightDockWidgetArea, dock)
    iface.mainWindow().resizeDocks([dock], [600], Qt.Orientation.Horizontal)
    plugin_dialog.show()
    iface.mapCanvas().setExtent(RANCHO_VEGA_EXTENT)
    iface.mapCanvas().refresh()
    log(f"registered: {plugin_dialog.editResSelectedResLabel.text()}")


def frame_rancho_vega(monuments):
    """Runs once the layers have loaded, so QGIS doesn't zoom back out."""
    for dock in iface.mainWindow().findChildren(QDockWidget):
        # The layer panel makes room for the attribute table's columns.
        if dock.objectName() in ("Browser", "Layers"):
            dock.hide()
    iface.messageBar().clearWidgets()
    iface.mapCanvas().setExtent(RANCHO_VEGA_EXTENT)
    iface.mapCanvas().refresh()
    iface.setActiveLayer(monuments)
    monuments.selectByExpression("\"name\" = 'Rancho Vega'")
    log(f"framed; selected={monuments.selectedFeatureCount()}")


def open_attribute_table(monuments):
    """Opens the table and docks it under the map, so one grab shows both.

    QGIS opens it as a separate window here, so the dialog is reparented
    into a bottom dock widget of the main window.
    """
    iface.showAttributeTable(monuments, "\"architect\" IS NOT NULL")
    table_dialogs = [
        widget
        for widget in QApplication.allWidgets()
        if widget.metaObject().className() == "QgsAttributeTableDialog"
    ]
    log(f"attribute table parents: {[type(dialog.parent()).__name__ for dialog in table_dialogs]}")
    if not table_dialogs:
        log("no attribute table window found")
        return
    table_dialog = table_dialogs[-1]
    table_dialog.setWindowFlags(Qt.WindowType.Widget)
    dock = QDockWidget("Attribute table: Paul R. Williams works", iface.mainWindow())
    dock.setWidget(table_dialog)
    iface.addDockWidget(Qt.DockWidgetArea.BottomDockWidgetArea, dock)
    # Tall enough for all eight rows at the large font, with no empty space.
    iface.mainWindow().resizeDocks([dock], [380], Qt.Orientation.Vertical)
    table_dialog.show()
    for table_view in table_dialog.findChildren(QTableView):
        table_font = table_view.font()
        table_font.setPointSize(TABLE_FONT_POINT_SIZE)
        table_view.setFont(table_font)
        table_view.horizontalHeader().setFont(table_font)
        table_view.verticalHeader().setFont(table_font)
        table_view.resizeColumnsToContents()
        table_view.resizeRowsToContents()
    iface.mapCanvas().setExtent(RANCHO_VEGA_EXTENT)
    iface.mapCanvas().refresh()
    log("attribute table docked")


def save_screenshot_and_quit(project, window, monuments):
    try:
        window.grab().save(OUTPUT_PATH)
        log(f"saved {OUTPUT_PATH}; features={monuments.featureCount()}")
    except Exception:
        log(traceback.format_exc())
    project.setDirty(False)
    os._exit(0)


log("startup script running")
try:
    project = QgsProject.instance()
    window = prepare_window()
    monuments = add_layers(project)
    log("layers added; waiting for them to load")
    QTimer.singleShot(1000, logging_errors(sign_in_to_arches))
    QTimer.singleShot(8000, logging_errors(lambda: frame_rancho_vega(monuments)))
    QTimer.singleShot(9000, logging_errors(lambda: open_attribute_table(monuments)))
    QTimer.singleShot(11000, logging_errors(lambda: register_rancho_vega(monuments)))
    QTimer.singleShot(
        DRAW_DELAY_MILLISECONDS,
        lambda: save_screenshot_and_quit(project, window, monuments),
    )
except Exception:
    log(traceback.format_exc())
    os._exit(1)
