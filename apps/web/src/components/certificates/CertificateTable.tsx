import { canDelete, canGeneratePdf, needsAnchoring } from "../../hooks/useCertificateActions";
import { formatDate, publicId, shortHash } from "../../lib/format";
import type { Certificate, SortField } from "../../types";
import { ModeBadge, StatusBadge, SyncBadge } from "../ui/Badges";
import { Icon } from "../ui/Icon";
import { ActionMenu, type MenuAction } from "../ui/Menu";

const COLUMNS: Array<{ field: SortField; label: string; className?: string }> = [
  { field: "studentName", label: "Titular" },
  { field: "title", label: "Credencial" },
  { field: "issuedAt", label: "Emisión", className: "col-date" },
  { field: "status", label: "Estado", className: "col-status" },
];

export function CertificateTable({
  items,
  sort,
  direction,
  onSort,
  onOpen,
  onValidate,
  onDownload,
  onRevoke,
  onDelete,
  onAnchor,
  canManage,
  isAdmin,
  working,
}: {
  items: Certificate[];
  sort: SortField;
  direction: "asc" | "desc";
  onSort: (field: SortField) => void;
  onOpen: (certificate: Certificate) => void;
  onValidate: (certificate: Certificate) => void;
  onDownload: (certificate: Certificate) => void;
  onRevoke: (certificate: Certificate) => void;
  onDelete: (certificate: Certificate) => void;
  onAnchor: (certificate: Certificate) => void;
  canManage: boolean;
  isAdmin: boolean;
  working: string | null;
}) {
  return (
    <div className="table-scroll">
      <table className="data-table">
        <caption className="visually-hidden">Certificados registrados. Las cabeceras permiten ordenar.</caption>
        <thead>
          <tr>
            {COLUMNS.map((column) => {
              const active = sort === column.field;
              return (
                <th
                  key={column.field}
                  scope="col"
                  className={column.className}
                  aria-sort={active ? (direction === "asc" ? "ascending" : "descending") : "none"}
                >
                  <button type="button" className="sort-button" onClick={() => onSort(column.field)}>
                    {column.label}
                    <Icon
                      name={active && direction === "asc" ? "sortAsc" : "sortDesc"}
                      size={14}
                      className={active ? "sort-icon active" : "sort-icon"}
                    />
                  </button>
                </th>
              );
            })}
            <th scope="col" className="col-id">
              Identificador
            </th>
            <th scope="col" className="col-actions">
              <span className="visually-hidden">Acciones</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((certificate) => {
            const actions: MenuAction[] = [{ label: "Validar ahora", icon: "verify", onSelect: () => onValidate(certificate) }];
            if (canGeneratePdf(certificate)) {
              actions.push({
                label: certificate.documentAvailable ? "Descargar PDF" : "Generar y descargar PDF",
                icon: "download",
                onSelect: () => onDownload(certificate),
                disabled: working === `pdf:${certificate.id}`,
              });
            }
            if (canManage && needsAnchoring(certificate)) {
              actions.push({ label: "Sincronizar con blockchain", icon: "refresh", onSelect: () => onAnchor(certificate) });
            }
            if (canManage && certificate.status !== "revoked" && !needsAnchoring(certificate)) {
              actions.push({ label: "Revocar", icon: "revoke", tone: "danger", onSelect: () => onRevoke(certificate) });
            }
            if (isAdmin && canDelete(certificate)) {
              actions.push({
                label: "Eliminar (datos de prueba)",
                icon: "trash",
                tone: "danger",
                onSelect: () => onDelete(certificate),
              });
            }

            return (
              <tr key={certificate.id}>
                <td>
                  <span className="cell-primary">{certificate.studentName}</span>
                </td>
                <td>
                  <span className="cell-primary">{certificate.title}</span>
                  <span className="cell-secondary">{certificate.institution}</span>
                </td>
                <td className="col-date">{formatDate(certificate.issuedAt)}</td>
                <td className="col-status">
                  <span className="badge-stack">
                    <StatusBadge status={certificate.status} />
                    <SyncBadge status={certificate.chainSyncStatus} />
                  </span>
                </td>
                <td className="col-id">
                  <span className="mono small" title={publicId(certificate)}>
                    {shortHash(publicId(certificate), 8, 4)}
                  </span>
                  <ModeBadge mode={certificate.evidenceMode} />
                </td>
                <td className="col-actions">
                  <div className="row-actions">
                    <button type="button" className="button ghost small" onClick={() => onOpen(certificate)}>
                      Ver detalle
                      <span className="visually-hidden">
                        {" "}
                        de {certificate.title}, {certificate.studentName}
                      </span>
                    </button>
                    <ActionMenu label={`Más acciones para ${certificate.title}, ${certificate.studentName}`} actions={actions} />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
