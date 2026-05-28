import * as hazardService from '../services/hazardService.js';

const fail = (res, err, status = 500) =>
    res.status(status).json({
        success: false,
        status: 'ERROR',
        message: err?.error || err?.message || 'Request failed',
        data: null
    });

export const listTypes = async (req, res) => {
    try {
        const types = await hazardService.listTypes();
        return res.status(200).json({
            success: true,
            status: 'OK',
            data: { types }
        });
    } catch (err) {
        return fail(res, err);
    }
};

export const getNearby = async (req, res) => {
    try {
        const result = await hazardService.getNearby(req.user.id, req.query);
        if (result.error) return fail(res, result, result.status);
        return res.status(200).json({
            success: true,
            status: 'OK',
            data: result
        });
    } catch (err) {
        return fail(res, err);
    }
};

export const createReport = async (req, res) => {
    try {
        const result = await hazardService.createReport(req.user.id, req.body, req.user);
        if (result.error) return fail(res, result, result.status);
        return res.status(201).json({
            success: true,
            status: 'OK',
            message: 'Hazard reported',
            data: result
        });
    } catch (err) {
        return fail(res, err);
    }
};

export const getReport = async (req, res) => {
    try {
        const hazardId = parseInt(req.params.id, 10);
        if (!Number.isInteger(hazardId)) return fail(res, { error: 'Invalid hazard id' }, 400);
        const result = await hazardService.getReport(req.user.id, hazardId);
        if (result.error) return fail(res, result, result.status);
        return res.status(200).json({
            success: true,
            status: 'OK',
            data: result
        });
    } catch (err) {
        return fail(res, err);
    }
};

export const vote = async (req, res) => {
    try {
        const hazardId = parseInt(req.params.id, 10);
        if (!Number.isInteger(hazardId)) return fail(res, { error: 'Invalid hazard id' }, 400);
        const result = await hazardService.voteOnReport(req.user.id, hazardId, req.body.vote);
        if (result.error) return fail(res, result, result.status);
        return res.status(200).json({
            success: true,
            status: 'OK',
            data: result
        });
    } catch (err) {
        return fail(res, err);
    }
};

export const listMine = async (req, res) => {
    try {
        const result = await hazardService.listMyReports(req.user.id, req.query);
        return res.status(200).json({
            success: true,
            status: 'OK',
            data: result
        });
    } catch (err) {
        return fail(res, err);
    }
};
