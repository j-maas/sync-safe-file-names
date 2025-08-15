/* eslint-disable @typescript-eslint/no-explicit-any */

export type Result<data, error> = Success<data> | Failure<error>

export function success<data, error>(data: data): Result<data, error> {
    return {
        success: true,
        data
    }
}

export type Success<data> = {
    success: true;
    data: data;
}

export function failure<data, error>(error: error, options: { message?: string, data?: any }): Result<data, error> {
    return {
        success: false,
        error: {
            code: error,
            ...options
        }
    }
}

export type Failure<error> = {
    success: false;
    error: {
        code: error;
        message?: string;
        data?: any;
    }
}
