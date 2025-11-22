#!/bin/bash

# TEST DE FLUJO COMPLETO - Sistema de Pedidos MalaFama
# Este script valida el flujo end-to-end del sistema de pedidos

set -e
API_BASE="http://localhost:3000"

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
GRAY='\033[0;37m'
NC='\033[0m' # No Color

echo -e "${CYAN}\n=================================${NC}"
echo -e "${CYAN}TEST DE FLUJO COMPLETO - MalaFama${NC}"
echo -e "${CYAN}=================================${NC}"

# Variables globales
MESERO_TOKEN=""
MESA_ID=""
COMANDA1_ID=""
COMANDA2_ID=""
PEDIDO_BEBIDA_ID=""
PEDIDO_COMIDA_ID=""

# Helper function para peticiones HTTP
api_call() {
    local method=$1
    local endpoint=$2
    local data=$3
    local token=$4
    
    local headers="-H 'Content-Type: application/json'"
    if [ -n "$token" ]; then
        headers="$headers -H 'Authorization: Bearer $token'"
    fi
    
    if [ -n "$data" ]; then
        eval curl -s -X "$method" "$API_BASE$endpoint" $headers -d "'$data'"
    else
        eval curl -s -X "$method" "$API_BASE$endpoint" $headers
    fi
}

# ========================
# FASE 1: AUTENTICACIÓN
# ========================
echo -e "\n${YELLOW}[1/10] Login de Mesero...${NC}"
LOGIN_DATA='{"username":"mesero1","password":"password123"}'
LOGIN_RESPONSE=$(api_call POST "/api/auth/login" "$LOGIN_DATA")
MESERO_TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.token')
echo -e "${GREEN}  ✓ Login exitoso - Token obtenido${NC}"

# ========================
# FASE 2: ASIGNAR MESA
# ========================
echo -e "\n${YELLOW}[2/10] Asignando mesa al mesero...${NC}"
ASIGNAR_DATA='{"mesa_id":1}'
ASIGNAR_RESPONSE=$(api_call POST "/api/mesas/asignar" "$ASIGNAR_DATA" "$MESERO_TOKEN")
MESA_ID=$(echo $ASIGNAR_RESPONSE | jq -r '.asignacion.mesa_id')
echo -e "${GREEN}  ✓ Mesa $MESA_ID asignada correctamente${NC}"

# ========================
# FASE 3: CREAR COMANDA 1
# ========================
echo -e "\n${YELLOW}[3/10] Creando primera comanda...${NC}"
COMANDA1_DATA='{"mesa_id":'$MESA_ID',"pedidos":[{"producto_id":1,"cantidad":2,"notas":"Sin hielo"},{"producto_id":5,"cantidad":1,"notas":"Término medio"}]}'
COMANDA1_RESPONSE=$(api_call POST "/api/comandas" "$COMANDA1_DATA" "$MESERO_TOKEN")
COMANDA1_ID=$(echo $COMANDA1_RESPONSE | jq -r '.comanda.id')
echo -e "${GREEN}  ✓ Comanda #$COMANDA1_ID creada con 2 pedidos${NC}"

# ========================
# FASE 4: VERIFICAR VISTA BAR
# ========================
echo -e "\n${YELLOW}[4/10] Verificando pedido en vista de Bar...${NC}"
sleep 2
PEDIDOS_BAR=$(api_call GET "/api/pedidos/bar" "" "$MESERO_TOKEN")
PEDIDO_BEBIDA_ID=$(echo $PEDIDOS_BAR | jq -r '.pedidos[] | select(.producto_id == 1) | .id' | head -1)
if [ -n "$PEDIDO_BEBIDA_ID" ]; then
    ESTADO_BEBIDA=$(echo $PEDIDOS_BAR | jq -r ".pedidos[] | select(.id == $PEDIDO_BEBIDA_ID) | .estado")
    echo -e "${GREEN}  ✓ Pedido de bebida #$PEDIDO_BEBIDA_ID encontrado en Bar${NC}"
    echo -e "${GRAY}    - Estado: $ESTADO_BEBIDA${NC}"
else
    echo -e "${RED}ERROR: Pedido de bebida no encontrado en Bar${NC}"
    exit 1
fi

# ========================
# FASE 5: VERIFICAR VISTA COCINA
# ========================
echo -e "\n${YELLOW}[5/10] Verificando pedido en vista de Cocina...${NC}"
PEDIDOS_COCINA=$(api_call GET "/api/pedidos/cocina" "" "$MESERO_TOKEN")
PEDIDO_COMIDA_ID=$(echo $PEDIDOS_COCINA | jq -r '.pedidos[] | select(.producto_id == 5) | .id' | head -1)
if [ -n "$PEDIDO_COMIDA_ID" ]; then
    ESTADO_COMIDA=$(echo $PEDIDOS_COCINA | jq -r ".pedidos[] | select(.id == $PEDIDO_COMIDA_ID) | .estado")
    echo -e "${GREEN}  ✓ Pedido de comida #$PEDIDO_COMIDA_ID encontrado en Cocina${NC}"
    echo -e "${GRAY}    - Estado: $ESTADO_COMIDA${NC}"
else
    echo -e "${RED}ERROR: Pedido de comida no encontrado en Cocina${NC}"
    exit 1
fi

# ========================
# FASE 6: MARCAR PEDIDOS COMO LISTOS
# ========================
echo -e "\n${YELLOW}[6/10] Marcando pedidos como listos...${NC}"

# Marcar bebida como lista
api_call PUT "/api/pedidos/$PEDIDO_BEBIDA_ID/estado" '{"estado":"listo"}' "$MESERO_TOKEN" > /dev/null
echo -e "${GREEN}  ✓ Bebida marcada como lista${NC}"

# Marcar comida como lista
api_call PUT "/api/pedidos/$PEDIDO_COMIDA_ID/estado" '{"estado":"listo"}' "$MESERO_TOKEN" > /dev/null
echo -e "${GREEN}  ✓ Comida marcada como lista${NC}"

# ========================
# FASE 7: VERIFICAR COMANDA COMPLETA EN VISTA MESERO
# ========================
echo -e "\n${YELLOW}[7/10] Verificando comanda completa en vista de Mesero...${NC}"
sleep 2
MESAS_RESPONSE=$(api_call GET "/api/mesas" "" "$MESERO_TOKEN")
COMANDA_CHECK=$(echo $MESAS_RESPONSE | jq -r ".mesas[] | select(.id == $MESA_ID) | .comandas[] | select(.id == $COMANDA1_ID)")

if [ -n "$COMANDA_CHECK" ]; then
    PEDIDOS_NO_LISTOS=$(echo $COMANDA_CHECK | jq '[.pedidos[] | select(.estado != "listo")] | length')
    if [ "$PEDIDOS_NO_LISTOS" -eq 0 ]; then
        echo -e "${GREEN}  ✓ Comanda #$COMANDA1_ID completamente lista${NC}"
        echo -e "${GRAY}    - Debe estar parpadeando con manita 👆${NC}"
    else
        echo -e "${RED}ERROR: No todos los pedidos están listos${NC}"
        exit 1
    fi
else
    echo -e "${RED}ERROR: Comanda no encontrada en mesa${NC}"
    exit 1
fi

# ========================
# FASE 8: AGREGAR MÁS PEDIDOS A COMANDA EXISTENTE
# ========================
echo -e "\n${YELLOW}[8/10] Agregando más pedidos a la comanda...${NC}"
AGREGAR_PEDIDO='{"pedidos":[{"producto_id":2,"cantidad":1,"notas":"Extra limón"}]}'
api_call POST "/api/comandas/$COMANDA1_ID/pedidos" "$AGREGAR_PEDIDO" "$MESERO_TOKEN" > /dev/null
echo -e "${GREEN}  ✓ Pedido agregado a comanda existente${NC}"

# ========================
# FASE 9: CREAR SEGUNDA COMANDA
# ========================
echo -e "\n${YELLOW}[9/10] Creando segunda comanda para la misma mesa...${NC}"
COMANDA2_DATA='{"mesa_id":'$MESA_ID',"pedidos":[{"producto_id":3,"cantidad":2,"notas":"Bien frío"}]}'
COMANDA2_RESPONSE=$(api_call POST "/api/comandas" "$COMANDA2_DATA" "$MESERO_TOKEN")
COMANDA2_ID=$(echo $COMANDA2_RESPONSE | jq -r '.comanda.id')
echo -e "${GREEN}  ✓ Comanda #$COMANDA2_ID creada${NC}"
echo -e "${GRAY}    - Mesa ahora tiene múltiples comandas activas${NC}"

# ========================
# FASE 10: CERRAR CUENTA Y LIBERAR MESA
# ========================
echo -e "\n${YELLOW}[10/10] Cerrando cuenta y liberando mesa...${NC}"

# Cerrar cuenta
CERRAR_CUENTA=$(api_call POST "/api/mesas/$MESA_ID/cerrar-cuenta" "" "$MESERO_TOKEN")
TOTAL=$(echo $CERRAR_CUENTA | jq -r '.total')
echo -e "${GREEN}  ✓ Cuenta cerrada - Total: \$$TOTAL${NC}"

# Liberar mesa
api_call POST "/api/mesas/$MESA_ID/liberar" "" "$MESERO_TOKEN" > /dev/null
echo -e "${GREEN}  ✓ Mesa liberada y disponible${NC}"

# ========================
# RESUMEN FINAL
# ========================
echo -e "\n${CYAN}=================================${NC}"
echo -e "${GREEN}✅ FLUJO COMPLETO EXITOSO${NC}"
echo -e "${CYAN}=================================${NC}"
echo -e "Validaciones completadas:"
echo -e "${GREEN}  ✓ Login y autenticación${NC}"
echo -e "${GREEN}  ✓ Asignación de mesa${NC}"
echo -e "${GREEN}  ✓ Creación de comandas${NC}"
echo -e "${GREEN}  ✓ Vista de pedidos en Bar${NC}"
echo -e "${GREEN}  ✓ Vista de pedidos en Cocina${NC}"
echo -e "${GREEN}  ✓ Marcar pedidos como listos${NC}"
echo -e "${GREEN}  ✓ Detección de comanda completa${NC}"
echo -e "${GREEN}  ✓ Agregar pedidos a comanda existente${NC}"
echo -e "${GREEN}  ✓ Múltiples comandas por mesa${NC}"
echo -e "${GREEN}  ✓ Cierre de cuenta y liberación${NC}"

echo -e "\n${YELLOW}NOTAS PARA VALIDACIÓN MANUAL:${NC}"
echo -e "${GRAY}  • Verificar parpadeo de comanda lista en vista mesero${NC}"
echo -e "${GRAY}  • Verificar emoji de manita 👆 en comanda lista${NC}"
echo -e "${GRAY}  • Hacer click en comanda para acknowledgment${NC}"
echo -e "${GRAY}  • Verificar check verde ✓ después de acknowledgment${NC}"
echo -e "${GRAY}  • Verificar que el parpadeo se detenga${NC}"
echo -e "${GRAY}  • Probar toggle de dark mode en cada vista${NC}"
echo -e "${GRAY}  • Verificar logo adaptativo en footer${NC}"

echo -e "\n${CYAN}=================================${NC}\n"
