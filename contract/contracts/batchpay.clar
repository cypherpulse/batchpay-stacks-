;; =============================================
;; StacksBatchPay - STX Only Batch Payroll Vault
;; 0.5% fee 
;; =============================================

(define-data-var treasury principal 'SPGDS0Y17973EN5TCHNHGJJ9B31XWQ5YX8A36C9B)   

(define-constant FEE_BPS u50)        ;; 0.5%
(define-constant FEE_DENOM u10000)
(define-constant MAX_BATCH u60)      ;; safe & cheap

(define-constant ERR_LENGTH (err u101))
(define-constant ERR_AMOUNT (err u102))
(define-constant ERR_RECIPIENT (err u103))

;; payer => employee => active
(define-map employees {payer: principal, employee: principal} bool)

;; History (payer => batch-id => batch details)
(define-map batch-counter principal uint)

(define-map payment-history 
  {payer: principal, batch-id: uint}
  {
    recipients: (list 60 principal),
    amounts: (list 60 uint),
    names: (list 60 (string-utf8 64)),
    timestamp: uint,
    total: uint,
    fee: uint
  })

;; ====================== HELPERS ======================
(define-private (get-to (p {to: principal, amount: uint, name: (string-utf8 64)})) (get to p))
(define-private (get-amount (p {to: principal, amount: uint, name: (string-utf8 64)})) (get amount p))
(define-private (get-name (p {to: principal, amount: uint, name: (string-utf8 64)})) (get name p))

;; Validate + auto-add employee
(define-private (validate-and-add (p {to: principal, amount: uint, name: (string-utf8 64)}) (acc (response bool uint)))
  (match acc
    prev
      (let ((to (get to p))
            (amt (get amount p)))
        (asserts! (not (is-eq to tx-sender)) ERR_RECIPIENT)
        (asserts! (> amt u0) ERR_AMOUNT)
        (map-set employees {payer: tx-sender, employee: to} true)
        (ok true))
    e (err e)))

;; Send one payment
(define-private (send-payment (p {to: principal, amount: uint, name: (string-utf8 64)}) (acc (response bool uint)))
  (match acc
    prev (stx-transfer? (get amount p) tx-sender (get to p))
    e (err e)))

;; ====================== EMPLOYEE MGMT ======================
(define-public (add-employee (emp principal))
  (ok (map-set employees {payer: tx-sender, employee: emp} true)))

(define-public (remove-employee (emp principal))
  (ok (map-delete employees {payer: tx-sender, employee: emp})))

(define-read-only (is-employee (emp principal))
  (default-to false (map-get? employees {payer: tx-sender, employee: emp})))

;; ====================== BATCH PAY ======================
(define-public (batch-pay 
    (payments (list 60 {to: principal, amount: uint, name: (string-utf8 64)})))
  
  (let (
    (payer tx-sender)
    (total (fold + (map get-amount payments) u0))
    (fee (/ (* total FEE_BPS) FEE_DENOM))
    (counter (default-to u0 (map-get? batch-counter payer)))
    (new-id (+ counter u1))
  )
    (asserts! (and (> (len payments) u0) (<= (len payments) MAX_BATCH)) ERR_LENGTH)

    ;; Auto-add employees + validation
    (try! (fold validate-and-add payments (ok true)))

    ;; 0.5% fee to your treasury
    (try! (stx-transfer? fee payer (var-get treasury)))

    ;; Pay everyone in one tx
    (try! (fold send-payment payments (ok true)))
;; Save to on-chain history
(map-set payment-history {payer: payer, batch-id: new-id}
  {
    recipients: (map get-to payments),
    amounts: (map get-amount payments),
    names: (map get-name payments),
    timestamp: burn-block-height,   
    total: total,
    fee: fee
  })

    (map-set batch-counter payer new-id)

    ;; Event (frontend/indexer friendly)
    (print {
      event: "batch-paid-stx",
      payer: payer,
      batch-id: new-id,
      recipients: (map get-to payments),
      amounts: (map get-amount payments),
      names: (map get-name payments),
      total: total,
      fee: fee
    })

    (ok true)
  ))

;; ====================== READ FUNCTIONS ======================
(define-read-only (get-batch-count (payer principal))
  (default-to u0 (map-get? batch-counter payer)))

(define-read-only (get-batch (payer principal) (batch-id uint))
  (map-get? payment-history {payer: payer, batch-id: batch-id}))

(define-read-only (get-treasury)
  (var-get treasury))

;; (Optional) Change treasury - only current treasury can call
(define-public (set-treasury (new-treasury principal))
  (begin
    (asserts! (is-eq tx-sender (var-get treasury)) (err u403))
    (ok (var-set treasury new-treasury))
  ))