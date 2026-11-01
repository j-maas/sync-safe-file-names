export type Result<Data, Error extends { code: string }> =
	| Success<Data>
	| Failure<Error>;

export type Success<Data> = {
	success: true;
	data: Data;
};

export type Failure<Error extends { code: string }> = {
	success: false;
	error: Error;
};

export function success<Data, Error extends { code: string }>(
	data: Data,
): Result<Data, Error> {
	return {
		success: true,
		data,
	};
}

export function failure<Data, Error extends { code: string }>(
	error: Error,
): Result<Data, Error> {
	return {
		success: false,
		error,
	};
}
