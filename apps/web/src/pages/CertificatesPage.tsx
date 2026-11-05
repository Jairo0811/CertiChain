import { useEffect, useState } from "react";
import { CertificateDrawer } from "../components/certificates/CertificateDrawer";
import { CertificateTable } from "../components/certificates/CertificateTable";
import { EmptyState, ErrorState, Spinner } from "../components/ui/Feedback";
import { Icon } from "../components/ui/Icon";
import { useAsync, useDebouncedValue } from "../hooks/useAsync";
import { useCertificateActions } from "../hooks/useCertificateActions";
import { messageFor } from "../lib/api";
import { certificateService } from "../services";
import type { CertificateStatus, SessionUser, SortField } from "../types";

const PAGE_SIZE = 10;

export function CertificatesPage({
  user,
  openId,
  onOpenChange,
  onIssue,
}: {
  user: SessionUser;
  openId: { id: string; validate?: boolean } | null;
  onOpenChange: (value: { id: string; validate?: boolean } | null) => void;
  onIssue: () => void;
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<CertificateStatus | "">("");
  const [sort, setSort] = useState<SortField>("createdAt");
  const [direction, setDirection] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const debouncedSearch = useDebouncedValue(search);

  const list = useAsync(
    (signal) =>
      certificateService.list({ page, pageSize: PAGE_SIZE, search: debouncedSearch, status: status || undefined, sort, direction }, signal),
    [page, debouncedSearch, status, sort, direction, refreshKey],
  );

  const actions = useCertificateActions((_updated, removedId) => {
    setRefreshKey((value) => value + 1);
    if (removedId && openId?.id === removedId) onOpenChange(null);
  });

  const canManage = user.role === "admin" || user.role === "issuer";
  const isAdmin = user.role === "admin";
  const filtersActive = Boolean(debouncedSearch.trim() || status);

  function changeSort(field: SortField) {
    if (field === sort) setDirection((value) => (value === "asc" ? "desc" : "asc"));
    else {
      setSort(field);
      setDirection(field === "issuedAt" ? "desc" : "asc");
    }
    setPage(1);
  }

  const data = list.data;
  const totalPages = data?.totalPages ?? 1;

  // After deletions the current page may no longer exist.
  useEffect(() => {
    if (data && page > data.totalPages) setPage(data.totalPages);
  }, [data, page]);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h2 className="page-title">Registro de certificados</h2>
          <p className="muted">Busca, valida y gestiona las credenciales emitidas.</p>
        </div>
        {canManage && (
          <button type="button" className="button primary" onClick={onIssue}>
            <Icon name="issue" size={16} /> Emitir certificado
          </button>
        )}
      </div>

      <section className="panel table-panel" aria-labelledby="list-title">
        <h3 id="list-title" className="visually-hidden">
          Lista de certificados
        </h3>
        <div className="toolbar" role="search">
          <label className="search-field">
            <Icon name="search" />
            <span className="visually-hidden">Buscar</span>
            <input
              type="search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Titular, título, institución o identificador"
              maxLength={120}
            />
          </label>
          <label className="select-field">
            <span className="visually-hidden">Filtrar por estado</span>
            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as CertificateStatus | "");
                setPage(1);
              }}
            >
              <option value="">Todos los estados</option>
              <option value="active">Vigentes</option>
              <option value="pending">Pendientes</option>
              <option value="revoked">Revocadas</option>
            </select>
          </label>
          <button type="button" className="icon-button bordered" onClick={list.reload} aria-label="Actualizar lista">
            <Icon name="refresh" />
          </button>
        </div>

        <div aria-live="polite" className="visually-hidden">
          {data && !list.loading ? `${data.total} ${data.total === 1 ? "certificado" : "certificados"} encontrados` : ""}
        </div>

        {list.error ? (
          <ErrorState message={messageFor(list.error, "No fue posible cargar los certificados.")} onRetry={list.reload} />
        ) : !data ? (
          <div className="loading-block">
            <Spinner label="Cargando certificados" />
          </div>
        ) : data.items.length === 0 ? (
          filtersActive ? (
            <EmptyState
              icon="search"
              title="Ningún certificado coincide"
              action={
                <button
                  type="button"
                  className="button ghost small"
                  onClick={() => {
                    setSearch("");
                    setStatus("");
                  }}
                >
                  Quitar filtros
                </button>
              }
            >
              Prueba con otros términos o cambia el filtro de estado.
            </EmptyState>
          ) : (
            <EmptyState
              title="Todavía no hay certificados"
              action={
                canManage && (
                  <button type="button" className="button primary small" onClick={onIssue}>
                    <Icon name="issue" size={16} /> Emitir el primero
                  </button>
                )
              }
            >
              Cada credencial emitida aparecerá aquí con su estado y evidencia.
            </EmptyState>
          )
        ) : (
          <div className={list.loading ? "is-refreshing" : ""} aria-busy={list.loading}>
            <CertificateTable
              items={data.items}
              sort={sort}
              direction={direction}
              onSort={changeSort}
              onOpen={(certificate) => onOpenChange({ id: certificate.id })}
              onValidate={(certificate) => onOpenChange({ id: certificate.id, validate: true })}
              onDownload={(certificate) => void actions.downloadPdf(certificate)}
              onAnchor={(certificate) => void actions.anchor(certificate)}
              onRevoke={actions.requestRevoke}
              onDelete={actions.requestDelete}
              canManage={canManage}
              isAdmin={isAdmin}
              working={actions.working}
            />
            <nav className="pagination" aria-label="Paginación">
              <span className="muted small">
                {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, data.total)} de {data.total}
              </span>
              <div className="pagination-controls">
                <button type="button" className="icon-button bordered" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} aria-label="Página anterior">
                  <Icon name="chevronLeft" />
                </button>
                <span aria-current="page">
                  Página {page} de {totalPages}
                </span>
                <button
                  type="button"
                  className="icon-button bordered"
                  disabled={page >= totalPages}
                  onClick={() => setPage((value) => value + 1)}
                  aria-label="Página siguiente"
                >
                  <Icon name="chevronRight" />
                </button>
              </div>
            </nav>
          </div>
        )}
      </section>

      {openId && (
        <CertificateDrawer
          key={openId.id}
          id={openId.id}
          validateOnOpen={openId.validate}
          refreshKey={refreshKey}
          isAdmin={isAdmin}
          canManage={canManage}
          working={actions.working}
          onClose={() => onOpenChange(null)}
          onChanged={() => setRefreshKey((value) => value + 1)}
          onDownload={(certificate) => void actions.downloadPdf(certificate)}
          onAnchor={(certificate) => void actions.anchor(certificate)}
          onRevoke={actions.requestRevoke}
          onDelete={actions.requestDelete}
        />
      )}
      {actions.dialog}
    </div>
  );
}
