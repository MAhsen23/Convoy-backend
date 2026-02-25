import * as vehicleModel from '../models/vehicleModel.js';

/**
 * GET /api/garage – list current user's vehicles (primary first)
 */
export const list = async (req, res) => {
    try {
        const vehicles = await vehicleModel.getByUserId(req.user.id);
        const data = vehicles.map(vehicleModel.toPublicVehicle);
        return res.status(200).json({
            success: true,
            status: 'OK',
            message: 'Garage retrieved',
            data: { vehicles: data }
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            status: 'ERROR',
            message: err.message || 'Failed to get garage',
            data: null
        });
    }
};

/**
 * POST /api/garage – add a vehicle
 * Body: { model, power?, fuel_type?, modifications?, image_url?, is_primary? }
 */
export const addVehicle = async (req, res) => {
    try {
        const { model, power, fuel_type, modifications, image_url, is_primary } = req.body;
        if (!model || typeof model !== 'string' || !model.trim()) {
            return res.status(400).json({
                success: false,
                status: 'ERROR',
                message: 'Model is required',
                data: null
            });
        }

        const vehicle = await vehicleModel.create({
            user_id: req.user.id,
            model: model.trim(),
            power,
            fuel_type,
            modifications,
            image_url,
            is_primary
        });

        return res.status(201).json({
            success: true,
            status: 'OK',
            message: 'Vehicle added',
            data: { vehicle: vehicleModel.toPublicVehicle(vehicle) }
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            status: 'ERROR',
            message: err.message || 'Failed to add vehicle',
            data: null
        });
    }
};

/**
 * GET /api/garage/:id – get one vehicle (must belong to current user)
 */
export const getVehicle = async (req, res) => {
    try {
        const vehicle = await vehicleModel.getByIdAndUserId(req.params.id, req.user.id);
        if (!vehicle) {
            return res.status(404).json({
                success: false,
                status: 'ERROR',
                message: 'Vehicle not found',
                data: null
            });
        }
        return res.status(200).json({
            success: true,
            status: 'OK',
            data: { vehicle: vehicleModel.toPublicVehicle(vehicle) }
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            status: 'ERROR',
            message: err.message || 'Failed to get vehicle',
            data: null
        });
    }
};

/**
 * PATCH /api/garage/:id – update vehicle (model, power, fuel_type, modifications, is_primary)
 */
export const updateVehicle = async (req, res) => {
    try {
        const vehicle = await vehicleModel.getByIdAndUserId(req.params.id, req.user.id);
        if (!vehicle) {
            return res.status(404).json({
                success: false,
                status: 'ERROR',
                message: 'Vehicle not found',
                data: null
            });
        }

        const updated = await vehicleModel.update(vehicle.id, req.user.id, req.body);
        return res.status(200).json({
            success: true,
            status: 'OK',
            message: 'Vehicle updated',
            data: { vehicle: vehicleModel.toPublicVehicle(updated) }
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            status: 'ERROR',
            message: err.message || 'Failed to update vehicle',
            data: null
        });
    }
};

/**
 * DELETE /api/garage/:id – remove vehicle
 */
export const deleteVehicle = async (req, res) => {
    try {
        const vehicle = await vehicleModel.getByIdAndUserId(req.params.id, req.user.id);
        if (!vehicle) {
            return res.status(404).json({
                success: false,
                status: 'ERROR',
                message: 'Vehicle not found',
                data: null
            });
        }

        await vehicleModel.remove(vehicle.id, req.user.id);
        return res.status(200).json({
            success: true,
            status: 'OK',
            message: 'Vehicle removed',
            data: null
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            status: 'ERROR',
            message: err.message || 'Failed to remove vehicle',
            data: null
        });
    }
};

/**
 * PATCH /api/garage/:id/primary – set this vehicle as primary (clears primary on others)
 */
export const setPrimary = async (req, res) => {
    try {
        const vehicle = await vehicleModel.getByIdAndUserId(req.params.id, req.user.id);
        if (!vehicle) {
            return res.status(404).json({
                success: false,
                status: 'ERROR',
                message: 'Vehicle not found',
                data: null
            });
        }

        const updated = await vehicleModel.update(vehicle.id, req.user.id, { is_primary: true });
        return res.status(200).json({
            success: true,
            status: 'OK',
            message: 'Primary vehicle updated',
            data: { vehicle: vehicleModel.toPublicVehicle(updated) }
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            status: 'ERROR',
            message: err.message || 'Failed to set primary vehicle',
            data: null
        });
    }
};
