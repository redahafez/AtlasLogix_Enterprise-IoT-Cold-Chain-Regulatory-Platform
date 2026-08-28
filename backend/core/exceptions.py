from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status
from rest_framework.exceptions import APIException

class ServiceUnavailableException(APIException):
    status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    default_detail = 'A required dependency is unavailable'
    default_code = 'SERVICE_UNAVAILABLE'

def custom_exception_handler(exc, context):
    response = exception_handler(exc, context)

    if response is not None:
        error_code = getattr(exc, 'default_code', 'ERROR')
        if response.status_code == 400:
            error_code = 'BAD_REQUEST'
        elif response.status_code == 401:
            error_code = 'UNAUTHORIZED'
        elif response.status_code == 403:
            error_code = 'FORBIDDEN'
        elif response.status_code == 404:
            error_code = 'NOT_FOUND'
        elif response.status_code == 409:
            error_code = 'CONFLICT'
        elif response.status_code == 503:
            error_code = 'SERVICE_UNAVAILABLE'

        message = str(exc.detail) if hasattr(exc, 'detail') and isinstance(exc.detail, (str, dict)) else str(exc)
        if isinstance(exc.detail, dict) and 'message' in exc.detail:
            message = exc.detail['message']
        elif isinstance(exc.detail, dict) and 'detail' in exc.detail:
            message = str(exc.detail['detail'])

        formatted_data = {
            'error': str(error_code).upper(),
            'message': message,
        }
        if isinstance(exc.detail, dict) and 'details' in exc.detail:
            formatted_data['details'] = exc.detail['details']
        
        response.data = formatted_data

    return response
