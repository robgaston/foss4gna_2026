"""QGIS startup script: shows the demo's QGIS view and saves a screenshot.

Loads foss4gna_monument_footprints (a PostGIS view over the Arches demo
database) over an OpenStreetMap basemap, zooms to Rancho Vega, docks the
attribute table filtered to Paul R. Williams's works, grabs the QGIS window
and quits. Run it with scripts/qgis/capture-qgis-screenshot.sh.
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
from qgis.utils import iface

OUTPUT_PATH = os.environ["QGIS_SCREENSHOT_PATH"]
LOG_PATH = os.environ.get("QGIS_SCREENSHOT_LOG", OUTPUT_PATH + ".log")
DRAW_DELAY_MILLISECONDS = int(os.environ.get("QGIS_SCREENSHOT_DELAY_MS", "12000"))
WINDOW_WIDTH, WINDOW_HEIGHT = 1600, 900
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
    # The table is about the relationship-derived columns, not the keys.
    table_config = monuments.attributeTableConfig()
    columns = table_config.columns()
    for column in columns:
        column.hidden = column.name in ("gid", "resourceinstanceid")
    table_config.setColumns(columns)
    table_config.setSortExpression('"built"')
    monuments.setAttributeTableConfig(table_config)
    project.addMapLayer(monuments)
    return monuments


def prepare_window():
    window = iface.mainWindow()
    window.showNormal()
    window.resize(WINDOW_WIDTH, WINDOW_HEIGHT)
    QgsSettings().setValue("qgis/dockAttributeTable", True)
    return window


def frame_rancho_vega(monuments):
    """Runs once the layers have loaded, so QGIS doesn't zoom back out."""
    for dock in iface.mainWindow().findChildren(QDockWidget):
        if dock.objectName() == "Browser":
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
        for widget in QApplication.topLevelWidgets()
        if isinstance(widget, QDialog) and widget.isVisible()
    ]
    if not table_dialogs:
        log("no attribute table window found")
        return
    table_dialog = table_dialogs[-1]
    table_dialog.setWindowFlags(Qt.WindowType.Widget)
    dock = QDockWidget("Attribute table: Paul R. Williams works", iface.mainWindow())
    dock.setWidget(table_dialog)
    iface.addDockWidget(Qt.DockWidgetArea.BottomDockWidgetArea, dock)
    iface.mainWindow().resizeDocks([dock], [330], Qt.Orientation.Vertical)
    table_dialog.show()
    for table_view in table_dialog.findChildren(QTableView):
        table_view.resizeColumnsToContents()
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
    QTimer.singleShot(3000, lambda: frame_rancho_vega(monuments))
    QTimer.singleShot(5000, lambda: open_attribute_table(monuments))
    QTimer.singleShot(
        DRAW_DELAY_MILLISECONDS,
        lambda: save_screenshot_and_quit(project, window, monuments),
    )
except Exception:
    log(traceback.format_exc())
    os._exit(1)
